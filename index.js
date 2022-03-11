const fetch = require('node-fetch')
const { access, writeFile } = require('fs/promises');

const sleep = time => new Promise(resolve => setTimeout(resolve, time))

// https://www.w3docs.com/snippets/javascript/how-to-encode-javascript-object-to-query-string.html
serialize = function (obj) {
  let str = [];
  for (let p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(String(obj[p])));
    }
  return str.join("&");
}

const audios = {}

async function downloadCatalog (base) {
  await Promise.all((new Array(25)).fill(null).map(async (_, i) => {
    const PageNumber = i + 1
    
    let failures = 0
    while (true) {
      try {
        const res = await fetch(`${base}&${serialize({
          PageNumber
        })}`)
        
        if (!res.ok) {
          if (res.status === 429) {
            failures++
            console.log('Page', PageNumber, 'ratelimited', failures)
            await sleep(1000 * failures)
            continue
          }
          console.log('Page', PageNumber, 'failed', res.status)
          return
        }
        
        const assets = await res.json()
        for (const asset of assets) {
          try {
            if (!asset.AudioUrl) {
              console.log(asset.AssetId, 'moderated')
              continue
            }
            audios[asset.AssetId] = asset.AudioUrl
            console.log(asset.AssetId, asset.Name)
          } catch (error) {
            console.log(asset.AssetId, 'errored', asset)
          }
        }
      } catch {
        console.log('Page', PageNumber, 'errored')
      }
    }
  }))
}

;(async () => {
  const BASE = 'https://search.roblox.com/catalog/json?CatalogContext=2&Category=9&'
  const promises = []
  for (const CurrencyType of [3, 5]) {
    for (const Genres of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15]) { // 12 doesn't exist
      for (const SortType of [0, 1, 2, 3, 4, 5]) {
        promises.push(downloadCatalog(BASE + serialize({
          CurrencyType, Genres, SortType
        })))
      }
    }
  }
  await Promise.all(promises)
  const total = Object.keys(audios).length
  for (const [i, audio] of Array.entries(Object.keys(audios))) {
    const path = `./mp3s/${audio}.mp3`
    try {
      await access(path)
      console.log(audio, 'already exists')
      continue
    } catch {}

    const mp3res = await fetch(audios[audio])
    
    if (!mp3res.ok) {
      console.log(audio, 'failed')
      continue
    }
    
    const mp3 = await mp3res.buffer()
    await writeFile(path, mp3)
    console.log(`${i}/${total}`, audio, audios[audio])
  }
})()