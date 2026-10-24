import { useEffect, useRef, useState } from 'react'
import './PlayPicture.css'
import uploadIcon from '../assets/upload-or-camera.svg'

export default function PlayPicture() {
    const fileInputRef = useRef(null)

    // The file the player just chose, waiting for user to confirm or cancel
    const [pendingFile, setPendingFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    // Free the preview URL when it changes or the component unmounts
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
        }
    }, [previewUrl])

    // Lets esc key close the popup while it is open
    useEffect(() => {
        if (!pendingFile) {
            return
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setPendingFile(null)
                setPreviewUrl(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [pendingFile])

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

        setPendingFile(file)
        setPreviewUrl(URL.createObjectURL(file))

        // Clear the input so picking the same file again still fires onChange
        event.target.value = ''
    }

    const handleCancel = () => {
        setPendingFile(null)
        setPreviewUrl(null)
    }

    const handleConfirm = () => {
        // TODO: do something with pendingFile (show it, upload it, etc.)

        setPendingFile(null)
        setPreviewUrl(null)
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

            {pendingFile && (
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
                            src={previewUrl}
                            alt="preview of the chosen image"
                        />

                        {/* <p className="play-picture-popup-name">{pendingFile.name}</p> */}

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