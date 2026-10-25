// Image helpers shared by the photo uploader (PlayPicture) and the create-room picture upload

// iPhone photos are HEIC by default. Some browsers leave file.type empty for them, so check the name too
export function isHeic(file) {
    return file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name)
}

// Most browsers (and the server's image library) can't decode HEIC, so convert it to a JPEG first.
// Other images are returned unchanged. The converter is only downloaded when a HEIC photo is picked.
export async function toBrowserImage(file) {
    if (!isHeic(file)) {
        return file
    }

    const { heicTo } = await import('heic-to')
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 })
    return new File([jpeg], file.name.replace(/\.hei[cf]$/i, '') + '.jpg', {
        type: 'image/jpeg',
        lastModified: file.lastModified,
    })
}
