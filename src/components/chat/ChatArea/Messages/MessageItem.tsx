import Icon from '@/components/ui/icon'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import { getTextDirection, splitLines } from '@/lib/textDirection'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { ChatMessage } from '@/types/os'
import Videos from './Multimedia/Videos'
import Images from './Multimedia/Images'
import Audios from './Multimedia/Audios'
import MetabaseEmbeds from './Multimedia/Embeds'
import { memo } from 'react'
import AgentThinkingLoader from './AgentThinkingLoader'

interface MessageProps {
  message: ChatMessage
}

const AgentMessage = ({ message }: MessageProps) => {
  const { streamingErrorMessage } = useStore()
  const agentPrimaryText =
    message.content || message.response_audio?.transcript || ''
  const agentDirection = getTextDirection(agentPrimaryText)
  const embeds = message.extra_data?.embeds ?? []
  let messageContent
  if (message.streamingError) {
    messageContent = (
      <p className="text-destructive">
        Oops! Something went wrong while streaming.{' '}
        {streamingErrorMessage ? (
          <>{streamingErrorMessage}</>
        ) : (
          'Please try refreshing the page or try again later.'
        )}
      </p>
    )
  } else if (message.content || embeds.length > 0) {
    messageContent = (
      <div className="flex w-full flex-col gap-4">
        {(message.content || message.response_audio?.transcript) && (
          <MarkdownRenderer
            classname={agentDirection === 'rtl' ? 'font-vazirmatn' : 'font-geist'}
          >
            {message.content || message.response_audio?.transcript}
          </MarkdownRenderer>
        )}
        {embeds.length > 0 && <MetabaseEmbeds embeds={embeds} />}
        {message.videos && message.videos.length > 0 && (
          <Videos videos={message.videos} />
        )}
        {message.images && message.images.length > 0 && (
          <Images images={message.images} />
        )}
        {message.audio && message.audio.length > 0 && (
          <Audios audio={message.audio} />
        )}
        {message.response_audio?.content && (
          <Audios audio={[message.response_audio]} />
        )}
      </div>
    )
  } else if (message.response_audio) {
    if (!message.response_audio.transcript) {
      messageContent = (
        <div className="mt-2 flex items-start">
          <AgentThinkingLoader />
        </div>
      )
    } else {
      messageContent = (
        <div className="flex w-full flex-col gap-4">
          <MarkdownRenderer
            classname={agentDirection === 'rtl' ? 'font-vazirmatn' : 'font-geist'}
          >
            {message.response_audio.transcript}
          </MarkdownRenderer>
          {message.response_audio.content && message.response_audio && (
            <Audios audio={[message.response_audio]} />
          )}
        </div>
      )
    }
  } else {
    messageContent = (
      <div className="mt-2">
        <AgentThinkingLoader />
      </div>
    )
  }

  return (
    <div className="flex flex-row items-start gap-4">
      <div className="flex-shrink-0">
        <Icon type="agent" size="sm" />
      </div>
      {messageContent}
    </div>
  )
}

const UserMessage = memo(({ message }: MessageProps) => {
  const messageLines = splitLines(message.content)

  return (
    <div className="flex items-start gap-4 pt-4 text-start max-md:break-words">
      <div className="flex-shrink-0">
        <Icon type="user" size="sm" />
      </div>
      <div className="text-md rounded-lg text-secondary">
        {messageLines.map((line, index) => {
          const lineDirection = getTextDirection(line)

          return (
            <p
              key={`${message.created_at}-${index}`}
              dir={lineDirection}
              className={cn(
                'bidi-plaintext break-words whitespace-pre-wrap',
                lineDirection === 'rtl'
                  ? 'font-vazirmatn text-right'
                  : 'font-geist text-left'
              )}
            >
              {line.length > 0 ? line : '\u00A0'}
            </p>
          )
        })}
      </div>
    </div>
  )
})

AgentMessage.displayName = 'AgentMessage'
UserMessage.displayName = 'UserMessage'
export { AgentMessage, UserMessage }
