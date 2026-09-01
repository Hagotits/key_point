export const KP_COLORS = [
  '#ff5252', '#ffb300', '#ffee58', '#9ccc65', '#26c6da',
  '#42a5f5', '#7e57c2', '#ec407a', '#26a69a', '#d4e157',
  '#ff7043', '#8d6e63', '#78909c', '#ab47bc', '#66bb6a',
]

let nextId = 1
export const uid = () => `id_${nextId++}_${Date.now().toString(36)}`

export function fitImageSize(image, bounds) {
  const scale = Math.min(1, bounds.width / image.width, bounds.height / image.height)
  return { width: image.width * scale, height: image.height * scale, scale }
}

// 파일 목록에서 이미지 파일만 골라 {id, name, url, width, height}로 로드
export function loadImageFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const url = URL.createObjectURL(file)
          const img = new Image()
          img.onload = () =>
            resolve({
              id: uid(),
              name: file.webkitRelativePath || file.name,
              url,
              blob: file,
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(null)
          }
          img.src = url
        })
    )
  ).then((results) => results.filter(Boolean))
}

export function restoreImageAssets(images) {
  return (Array.isArray(images) ? images : []).map((image) => ({
    ...image,
    url:
      image.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(image.blob)
        : image.url || '',
  }))
}
