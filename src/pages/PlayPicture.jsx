import { useEffect, useRef, useState } from 'react'
import ExifReader from 'exifreader'
import './PlayPicture.css'
import uploadIcon from '../assets/upload-or-camera.svg'

// Turns a byte count into something readable, like "2.4 MB"
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B'
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB'
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getOrientation(width, height) {
    if (width > height) {
        return 'landscape'
    }
    if (width < height) {
        return 'portrait'
    }
    return 'square'
}

// Reads the GPS position stored inside the photo (EXIF data).
// Returns { latitude, longitude } as numbers, or null if the photo has no location.
async function readLocation(file) {
    try {
        const buffer = await file.arrayBuffer()
        const tags = await ExifReader.load(buffer, { expanded: true })

        if (!tags.gps) {
            return null
        }

        const latitude = tags.gps.Latitude
        const longitude = tags.gps.Longitude

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return null
        }

        return { latitude: latitude, longitude: longitude }
    } catch {
        // The file has no metadata at all, or a format the library can't read
        return null
    }
}

// Turns { latitude, longitude } into text like "51.04470, -114.07190"
function formatCoordinates(location) {
    if (!location) {
        return 'undefined'
    }
    return location.latitude.toFixed(5) + ', ' + location.longitude.toFixed(5)
}

export default function PlayPicture() {
    const fileInputRef = useRef(null)

    // The image waiting to be confirmed, or null when no popup is open.
    // Shape: { file, url, metadata }
    const [pending, setPending] = useState(null)

    // Free the preview URL when the pending image changes or the component unmounts
    useEffect(() => {
        return () => {
            if (pending) {
                URL.revokeObjectURL(pending.url)
            }
        }
    }, [pending])

    // Let the Escape key close the popup while it is open
    useEffect(() => {
        if (!pending) {
            return
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setPending(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [pending])

    // The visible button forwards its click to the hidden file input,
    // which is what opens the file explorer (Finder on a Mac)
    const handleButtonClick = () => {
        fileInputRef.current.click()
    }

    const handleFileChange = (event) => {
        const file = event.target.files[0]

        if (!file) {
            return
        }

        if (!file.type.startsWith('image/')) {
            alert('please choose an image file')
            return
        }

        // Load the image in memory so the browser can tell us its real dimensions.
        // The popup only opens once this finishes, so the metadata is always complete.
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = async () => {
            const width = img.naturalWidth
            const height = img.naturalHeight

            // Look for GPS coordinates inside the file (null if there are none)
            const location = await readLocation(file)

            setPending({
                file: file,
                url: url,
                metadata: {
                    name: file.name,
                    type: file.type,
                    size: formatFileSize(file.size),
                    width: width,
                    height: height,
                    orientation: getOrientation(width, height),
                    lastModified: new Date(file.lastModified).toLocaleDateString(),
                    location: location,
                },
            })
        }

        // Catches files that claim to be images but are corrupt or unsupported
        img.onerror = () => {
            URL.revokeObjectURL(url)
            alert("couldn't read this image")
        }

        img.src = url

        // Clear the input so picking the same file again still fires onChange
        event.target.value = ''
    }

    const handleCancel = () => {
        setPending(null)
    }

    const handleConfirm = () => {
        // TODO: do something with pending.file and pending.metadata
        // (show it, upload it, save the metadata, etc.)
        // For now, confirming just closes the popup
        setPending(null)
    }

    return (
        <div className="play-picture">
            <span className="play-picture-placeholder">picture goes here</span>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="play-picture-file-input"
                onChange={handleFileChange}
            />

            <button
                type="button"
                className="play-picture-hover-btn"
                onClick={handleButtonClick}
                aria-label="upload image"
                title="upload image"
            >
                <img className="play-picture-hover-btn-icon" src={uploadIcon} alt="" />
            </button>

            {pending && (
                <div className="play-picture-overlay" onClick={handleCancel}>
                    <div
                        className="play-picture-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="play-picture-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="play-picture-popup-title" className="play-picture-popup-title">
                            use this image?
                        </h2>

                        <img
                            className="play-picture-popup-img"
                            src={pending.url}
                            alt="preview of the chosen image"
                        />

                        <dl className="play-picture-meta">
                            <div className="play-picture-meta-row">
                                <dt>name</dt>
                                <dd>{pending.metadata.name}</dd>
                            </div>
                            <div className="play-picture-meta-row">
                                <dt>type</dt>
                                <dd>{pending.metadata.type}</dd>
                            </div>
                            <div className="play-picture-meta-row">
                                <dt>size</dt>
                                <dd>{pending.metadata.size}</dd>
                            </div>
                            {/* <div className="play-picture-meta-row">
                                <dt>dimensions</dt>
                                <dd>
                                    {pending.metadata.width} × {pending.metadata.height} px
                                </dd>
                            </div>
                            <div className="play-picture-meta-row">
                                <dt>orientation</dt>
                                <dd>{pending.metadata.orientation}</dd>
                            </div>
                            <div className="play-picture-meta-row">
                                <dt>modified</dt>
                                <dd>{pending.metadata.lastModified}</dd>
                            </div> */}
                            <div className="play-picture-meta-row">
                                <dt>location</dt>
                                <dd>{formatCoordinates(pending.metadata.location)}</dd>
                            </div>
                        </dl>

                        <div className="play-picture-popup-actions">
                            <button
                                type="button"
                                className="play-picture-popup-btn"
                                onClick={handleCancel}
                            >
                                cancel
                            </button>
                            <button
                                type="button"
                                className="play-picture-popup-btn play-picture-popup-btn-confirm"
                                onClick={handleConfirm}
                            >
                                confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}