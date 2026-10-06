import { createWorker } from 'tesseract.js'

// Owning the Tesseract worker inside this worker lets the UI stop its entire
// worker tree even while the WASM or model is still loading.
let worker
self.onmessage = async ({ data: { id, type, payload } }) => {
  try {
    let result
    if (type === 'initialize') {
      worker = await createWorker('eng', 1, {
        ...payload,
        logger: message => self.postMessage({ type: 'progress', message }),
        errorHandler: error => self.postMessage({ id, error: String(error) })
      })
    } else if (type === 'setParameters') result = await worker.setParameters(payload)
    else if (type === 'recognize') result = await worker.recognize(payload)
    else throw new Error('Unknown OCR request')
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) })
  }
}
