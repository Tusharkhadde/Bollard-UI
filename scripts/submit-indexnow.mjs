const KEY = "530d5b41054f4a3ea3be7fc28f645856"
const HOST = "bollard-ui.vercel.app"
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

const urlList = [
  `https://${HOST}/`,
  `https://${HOST}/about`,
  `https://${HOST}/india`,
  `https://${HOST}/flows`,
  `https://${HOST}/flows/checkout`,
  `https://${HOST}/flows/danger-zone`,
  `https://${HOST}/flows/signup-login`,
  `https://${HOST}/guides/react-prevent-duplicate-form-submit`,
  `https://${HOST}/guides/react-india-form-validation`,
  `https://${HOST}/guides/react-type-to-confirm-dialog`,
  `https://${HOST}/guides/react-email-typo-detection`,
  `https://${HOST}/guides/bollard-ui-vs-zod-validation`,
]

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList,
}

console.log("Submitting URLs to IndexNow (Bing / Copilot / Yandex)...")
console.log(`Key: ${KEY}`)
console.log(`URLs to submit: ${urlList.length}`)

async function submit() {
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    })

    if (res.ok || res.status === 200 || res.status === 202) {
      console.log(`✅ IndexNow submission successful! Status: ${res.status}`)
    } else {
      console.log(`⚠️ IndexNow responded with HTTP ${res.status}: ${await res.text()}`)
    }
  } catch (err) {
    console.log(`ℹ️ IndexNow submission skipped or network unavailable: ${err.message}`)
  }
}

submit()
