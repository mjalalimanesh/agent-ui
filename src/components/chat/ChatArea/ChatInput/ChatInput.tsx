'use client'
import { type DragEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { TextArea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'

const MAX_IMAGE_ATTACHMENTS = 4

const ChatInput = () => {
  const { chatInputRef } = useStore()

  const { handleStreamResponse } = useAIChatStreamHandler()
  const [selectedAgent] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const [inputMessage, setInputMessage] = useState('')
  const [attachedImages, setAttachedImages] = useState<File[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const isStreaming = useStore((state) => state.isStreaming)
  const isAgentOrTeamSelected = Boolean(selectedAgent || teamId)

  const addImages = (files: File[]) => {
    if (files.length === 0) return

    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length !== files.length) {
      toast.error('Only image files are supported.')
    }

    let reachedLimit = false
    setAttachedImages((prevImages) => {
      const merged = [...prevImages]
      for (const image of imageFiles) {
        const duplicate = merged.some(
          (existing) =>
            existing.name === image.name &&
            existing.size === image.size &&
            existing.lastModified === image.lastModified
        )
        if (!duplicate) {
          merged.push(image)
        }
      }
      if (merged.length > MAX_IMAGE_ATTACHMENTS) {
        reachedLimit = true
      }
      return merged.slice(0, MAX_IMAGE_ATTACHMENTS)
    })

    if (reachedLimit) {
      toast.error(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`)
    }
  }

  const removeImage = (indexToRemove: number) => {
    setAttachedImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove)
    )
  }

  const canSubmit =
    isAgentOrTeamSelected &&
    !isStreaming &&
    (inputMessage.trim().length > 0 || attachedImages.length > 0)

  const hasDraggedImage = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.items).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    )

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!hasDraggedImage(event)) return
    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!hasDraggedImage(event)) return
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragActive) {
      setIsDragActive(true)
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!hasDraggedImage(event)) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragActive(false)
    if (!isAgentOrTeamSelected || isStreaming) return
    addImages(Array.from(event.dataTransfer.files ?? []))
  }

  const handleSubmit = async () => {
    if (!inputMessage.trim() && attachedImages.length === 0) return

    const currentMessage = inputMessage.trim()
    const currentImages = attachedImages
    setInputMessage('')
    setAttachedImages([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    try {
      const formData = new FormData()
      formData.append('message', currentMessage)
      for (const image of currentImages) {
        formData.append('files', image)
      }
      await handleStreamResponse(formData)
    } catch (error) {
      toast.error(
        `Error in handleSubmit: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return (
    <div className="mx-auto mb-1 flex w-full max-w-2xl flex-col gap-y-2 font-geist">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addImages(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachedImages.map((image, index) => (
            <div
              key={`${image.name}-${image.size}-${image.lastModified}-${index}`}
              className="flex max-w-full items-center gap-2 rounded-md border border-accent bg-primaryAccent px-2 py-1 text-xs text-primary"
            >
              <span className="max-w-40 truncate">{image.name}</span>
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="rounded-sm p-0.5 hover:bg-secondary/20"
                aria-label={`Remove ${image.name}`}
              >
                <Icon type="x" size="xxs" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`relative rounded-xl transition-colors ${
          isDragActive ? 'bg-primaryAccent/60 ring-1 ring-accent' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primaryAccent/90 backdrop-blur-sm">
            <p className="text-sm font-medium text-primary">Drop images to attach</p>
          </div>
        )}
        <div className="flex items-end justify-center gap-x-2">
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!isAgentOrTeamSelected || isStreaming}
          size="icon"
          className="rounded-xl border border-accent bg-primaryAccent p-5 text-primary"
          aria-label="Attach image"
        >
          <Icon type="plus-icon" color="primary" />
        </Button>
        <TextArea
          placeholder={'Ask anything'}
          value={inputMessage}
          dir="auto"
          onChange={(e) => setInputMessage(e.target.value)}
          onPaste={(e) => {
            const pastedFiles = Array.from(e.clipboardData.files ?? [])
            const pastedImages = pastedFiles.filter((file) =>
              file.type.startsWith('image/')
            )
            if (pastedImages.length > 0) {
              e.preventDefault()
              addImages(pastedImages)
            }
          }}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              !e.shiftKey &&
              !isStreaming
            ) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="w-full border border-accent bg-primaryAccent px-4 text-sm text-primary focus:border-accent"
          disabled={!isAgentOrTeamSelected}
          ref={chatInputRef}
        />
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="icon"
          className="rounded-xl bg-primary p-5 text-primaryAccent"
        >
          <Icon type="send" color="primaryAccent" />
        </Button>
        </div>
      </div>
      <Button
        type="button"
        onClick={() => {
          setAttachedImages([])
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
        variant="ghost"
        className="h-auto w-fit self-start px-0 py-0 text-xs text-muted hover:bg-transparent hover:text-primary"
        disabled={attachedImages.length === 0}
      >
        Clear images
      </Button>
    </div>
  )
}

export default ChatInput
