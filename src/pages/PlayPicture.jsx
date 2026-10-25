import { useEffect, useRef, useState } from 'react'
import ExifReader from 'exifreader'
import './PlayPicture.css'
import uploadIcon from '../assets/upload-or-camera.svg'
import { supabase } from '../lib/supabase.mjs'

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

// iPhone photos are HEIC by default. Some browsers leave file.type empty for them, so check the name too
function isHeic(file) {
    return file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name)
}

// Most browsers (and the server's image library) can't decode HEIC, so convert it to a JPEG first.
// Other images are returned unchanged. The converter is only downloaded when a HEIC photo is picked.
async function toBrowserImage(file) {
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

// Asks the server for a photo's most prominent colour ('#rrggbb'), or null if it couldn't find one
async function fetchPhotoColor(file) {
    try {
        const res = await fetch('/api/photoColor/extract', {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
        })
        const data = await res.json()
        return res.ok ? data.photoColor : null
    } catch {
        return null
    }
}

// Where the checked photos' locations are kept in the browser
const PHOTO_LOCATIONS_KEY = 'coloringlook.photoLocations'

// Adds one checked photo's location to the list in localStorage.
// Returns true if it was saved (false if the browser blocks storage).
function savePhotoLocation(entry) {
    try {
        const saved = JSON.parse(localStorage.getItem(PHOTO_LOCATIONS_KEY) || '[]')
        saved.push(entry)
        localStorage.setItem(PHOTO_LOCATIONS_KEY, JSON.stringify(saved))
        return true
    } catch {
        return false
    }
}

// Turns one of the server's colour comparisons into text like "12° hue apart (within 35°)"
// or "44° hue apart, but both blue"
function describeComparison(comparison) {
    if (comparison.kind === 'mismatch') {
        return 'colour vs grey, no match'
    }
    if (comparison.kind === 'hue') {
        if (comparison.sameFamily && comparison.difference > comparison.tolerance) {
            return comparison.difference + '° hue apart, but both ' + comparison.family
        }
        return comparison.difference + '° hue apart (within ' + comparison.tolerance + '°)'
    }
    return comparison.difference + ' lightness apart (within ' + comparison.tolerance + ')'
}

const RESULT_TITLES = {
    matched: 'colour matched!',
    no_match: 'not close enough',
    no_colours: 'no colours yet',
}

// onScored is called after a matched photo's points are saved.
// onPopupChange(open) is called whenever the confirm or result popup opens or closes, so the page
// can hold back the picture's animation until the player is done with this one.
// can hold back other popups (like "completed!") until the player is done with this one.
export default function PlayPicture({ groupId, onScored, onPopupChange, children }) {
    const fileInputRef = useRef(null)

    // The image waiting to be confirmed, or null when no popup is open.
    // Shape: { file, url, metadata }
    const [pending, setPending] = useState(null)

    // The pending photo's most prominent colour, kept apart from pending so updating it doesn't
    // free the preview URL. Shape: { file, color } where color is undefined while it's being found
    // and null if it couldn't be found
    const [pendingColor, setPendingColor] = useState(null)

    // True while the confirmed photo is being checked by the server
    const [submitting, setSubmitting] = useState(false)

    // What the server said about the confirmed photo, or null when no result popup is open.
    // Shape: { url, data } on success, { url, error } if the check failed
    const [result, setResult] = useState(null)

    // Free the preview URL when the pending image changes or the component unmounts
    useEffect(() => {
        return () => {
            if (pending) {
                URL.revokeObjectURL(pending.url)
            }
        }
    }, [pending])

    // Same for the result popup's copy of the photo
    useEffect(() => {
        return () => {
            if (result) {
                URL.revokeObjectURL(result.url)
            }
        }
    }, [result])

    // Tell the page whether one of this component's popups is showing
    const popupOpen = Boolean(pending || result)
    useEffect(() => {
        onPopupChange?.(popupOpen)
    }, [popupOpen, onPopupChange])

    // Let the Escape key close whichever popup is open (but not while a photo is being checked)
    useEffect(() => {
        if ((!pending && !result) || submitting) {
            return
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setPending(null)
                handleCloseResult()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [pending, result, submitting])

    // The visible button forwards its click to the hidden file input,
    // which is what opens the file explorer (Finder on a Mac)
    const handleButtonClick = () => {
        fileInputRef.current.click()
    }

    const handleFileChange = async (event) => {
        const original = event.target.files[0]

        // Clear the input so picking the same file again still fires onChange
        event.target.value = ''

        if (!original) {
            return
        }

        if (!original.type.startsWith('image/') && !isHeic(original)) {
            alert('please choose an image file')
            return
        }

        let file
        try {
            file = await toBrowserImage(original)
        } catch {
            alert("couldn't read this image")
            return
        }

        // Load the image in memory so the browser can tell us its real dimensions.
        // The popup only opens once this finishes, so the metadata is always complete.
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = async () => {
            const width = img.naturalWidth
            const height = img.naturalHeight

            // Look for GPS coordinates inside the file (null if there are none). Uses the original,
            // since converting a HEIC photo to JPEG drops its metadata
            const location = await readLocation(original)

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

            // Find the main colour while the popup is open. If another photo was picked in the
            // meantime, this answer is for the old one and is ignored
            setPendingColor({ file: file, color: undefined })
            const color = await fetchPhotoColor(file)
            setPendingColor((current) => (current && current.file === file ? { file: file, color: color } : current))
        }

        // Catches files that claim to be images but are corrupt or unsupported
        img.onerror = () => {
            URL.revokeObjectURL(url)
            alert("couldn't read this image")
        }

        img.src = url
    }

    const handleCancel = () => {
        if (!submitting) {
            setPending(null)
        }
    }

    // Sends the photo to the server, which finds its most prominent colour and checks it
    // against this player's colours, then swaps the confirm popup for the result popup
    const handleConfirm = async () => {
        const file = pending.file
        const location = pending.metadata.location
        setSubmitting(true)

        let outcome
        try {
            const { data: authData, error } = await supabase.auth.getUser()
            if (error || !authData.user) {
                throw new Error('please log in again')
            }

            const res = await fetch(`/api/photoColor?userId=${authData.user.id}&groupId=${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            })
            // Some errors (like a photo over the size limit) don't come back as JSON
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.message || `status ${res.status}`)
            }
            // Photos without GPS data have nothing to save
            const locationSaved = location !== null && savePhotoLocation({
                latitude: location.latitude,
                longitude: location.longitude,
                color: data.photoColor,
                groupId: groupId,
                savedAt: new Date().toISOString(),
            })

            // A matched photo earns points: the server measures how far from spawn it was taken
            let score = null
            if (data.status === 'matched') {
                try {
                    const scoreRes = await fetch('/api/score', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: authData.user.id,
                            groupId: groupId,
                            color: data.color,
                            latitude: location ? location.latitude : undefined,
                            longitude: location ? location.longitude : undefined,
                        }),
                    })
                    const scoreData = await scoreRes.json().catch(() => ({}))
                    score = scoreRes.ok ? scoreData : { error: scoreData.message || `status ${scoreRes.status}` }
                    // Let the page redraw the picture with the newly filled-in cells
                    if (scoreRes.ok && onScored) {
                        onScored()
                    }
                } catch {
                    score = { error: 'could not reach the server' }
                }
            }

            outcome = { data: data, location: location, locationSaved: locationSaved, score: score }
        } catch (err) {
            outcome = { error: err.message }
        }

        // The result popup gets its own preview URL, since the pending one is freed when pending clears
        setResult({ ...outcome, url: URL.createObjectURL(file) })
        setPending(null)
        setSubmitting(false)
    }

    // Once the points are saved, closing the popup reloads the page so everything shows the new scores
    const handleCloseResult = () => {
        if (result && result.score && !result.score.error) {
            window.location.reload()
            return
        }
        setResult(null)
    }

    return (
        <div className="play-picture">
            {children ?? <span className="play-picture-placeholder">picture goes here</span>}

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

                        {/* The photo's most prominent colour, once the server has found it */}
                        {pendingColor && pendingColor.file === pending.file && (
                            pendingColor.color ? (
                                <div className="play-picture-result-color">
                                    <span
                                        className="play-picture-swatch"
                                        style={{ background: pendingColor.color }}
                                    />
                                    <span>main colour {pendingColor.color}</span>
                                </div>
                            ) : (
                                <p className="play-picture-popup-hint">
                                    {pendingColor.color === undefined
                                        ? 'finding main colour...'
                                        : "couldn't find the main colour"}
                                </p>
                            )
                        )}

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

                        {!groupId && (
                            <p className="play-picture-popup-hint">pick a book first</p>
                        )}

                        <div className="play-picture-popup-actions">
                            <button
                                type="button"
                                className="play-picture-popup-btn"
                                onClick={handleCancel}
                                disabled={submitting}
                            >
                                cancel
                            </button>
                            <button
                                type="button"
                                className="play-picture-popup-btn play-picture-popup-btn-confirm"
                                onClick={handleConfirm}
                                disabled={submitting || !groupId}
                            >
                                {submitting ? 'checking...' : 'confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {result && (
                <div className="play-picture-overlay" onClick={handleCloseResult}>
                    <div
                        className="play-picture-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="play-picture-result-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="play-picture-result-title" className="play-picture-popup-title">
                            {result.error ? "couldn't check this photo" : RESULT_TITLES[result.data.status]}
                        </h2>

                        <img
                            className="play-picture-popup-img"
                            src={result.url}
                            alt="the photo you uploaded"
                        />

                        {result.error && (
                            <p className="play-picture-popup-hint">{result.error}</p>
                        )}

                        {result.data && (
                            <>
                                {/* The photo's most prominent colour */}
                                <div className="play-picture-result-color">
                                    <span
                                        className="play-picture-swatch"
                                        style={{ background: result.data.photoColor }}
                                    />
                                    <span>main colour {result.data.photoColor}</span>
                                </div>

                                <p className="play-picture-popup-hint">
                                    {result.locationSaved
                                        ? 'location ' + formatCoordinates(result.location) + ' saved'
                                        : result.location
                                            ? "couldn't save the location"
                                            : 'this photo has no location'}
                                </p>

                                {result.data.status === 'matched' && (
                                    <div className="play-picture-result-color">
                                        <span
                                            className="play-picture-swatch"
                                            style={{ background: result.data.color }}
                                        />
                                        <span>counts as your {result.data.color}</span>
                                    </div>
                                )}

                                {result.score && (
                                    <p className="play-picture-popup-hint">
                                        {result.score.error
                                            ? "couldn't add points: " + result.score.error
                                            : '+' + result.score.points + ' points ('
                                            + (result.score.distanceKm === null
                                                ? 'no location, base points only'
                                                : result.score.distanceKm + ' km from spawn')
                                            + '), total ' + result.score.newScore}
                                    </p>
                                )}

                                {result.data.status === 'no_colours' && (
                                    <p className="play-picture-popup-hint">{result.data.message}</p>
                                )}

                                {/* How close the photo's colour is to each of the player's colours */}
                                {result.data.comparisons && (
                                    <ul className="play-picture-compare">
                                        {result.data.comparisons.map((comparison) => (
                                            <li
                                                key={comparison.color}
                                                className={
                                                    comparison.color === result.data.color
                                                        ? 'play-picture-compare-row play-picture-compare-match'
                                                        : 'play-picture-compare-row'
                                                }
                                            >
                                                <span
                                                    className="play-picture-swatch"
                                                    style={{ background: comparison.color }}
                                                />
                                                <span className="play-picture-compare-text">
                                                    {describeComparison(comparison)}
                                                </span>
                                                <span>{comparison.close ? 'close' : 'too far'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}

                        <div className="play-picture-popup-actions">
                            <button
                                type="button"
                                className="play-picture-popup-btn play-picture-popup-btn-confirm"
                                onClick={handleCloseResult}
                            >
                                done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}