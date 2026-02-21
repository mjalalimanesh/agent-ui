import { useCallback } from 'react'
import { getSessionAPI, getAllSessionsAPI } from '@/api/os'
import { useStore } from '../store'
import { toast } from 'sonner'
import {
  type AgentExtraData,
  ChatMessage,
  ToolCall,
  ReasoningMessage,
  type MetabaseEmbedData
} from '@/types/os'
import { getJsonMarkdown } from '@/lib/utils'

interface SessionRunResponse {
  run_input?: string
  content?: string | object
  tools?: ToolCall[]
  extra_data?: AgentExtraData
  metadata?: {
    embeds?: MetabaseEmbedData[]
  }
  session_state?: {
    metabase_embeds?: MetabaseEmbedData[]
    [key: string]: unknown
  }
  images?: ChatMessage['images']
  videos?: ChatMessage['videos']
  audio?: ChatMessage['audio']
  response_audio?: ChatMessage['response_audio']
  created_at: number
}

interface LoaderArgs {
  entityType: 'agent' | 'team' | null
  agentId?: string | null
  teamId?: string | null
  dbId: string | null
}

const isMetabaseEmbedData = (value: unknown): value is MetabaseEmbedData => {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<MetabaseEmbedData>
  return (
    data.kind === 'metabase_question' &&
    typeof data.question_id === 'number' &&
    typeof data.iframe_url === 'string' &&
    typeof data.open_url === 'string' &&
    typeof data.expires_at === 'number'
  )
}

const parseEmbeds = (value: unknown): MetabaseEmbedData[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isMetabaseEmbedData)
}

const mergeEmbeds = (
  existingEmbeds: MetabaseEmbedData[] = [],
  incomingEmbeds: MetabaseEmbedData[] = []
): MetabaseEmbedData[] => {
  const merged = new Map<string, MetabaseEmbedData>()
  for (const embed of existingEmbeds) {
    merged.set(`${embed.kind}-${embed.question_id}`, embed)
  }
  for (const embed of incomingEmbeds) {
    merged.set(`${embed.kind}-${embed.question_id}`, embed)
  }
  return Array.from(merged.values())
}

const useSessionLoader = () => {
  const setMessages = useStore((state) => state.setMessages)
  const selectedEndpoint = useStore((state) => state.selectedEndpoint)
  const authToken = useStore((state) => state.authToken)
  const setIsSessionsLoading = useStore((state) => state.setIsSessionsLoading)
  const setSessionsData = useStore((state) => state.setSessionsData)

  const getSessions = useCallback(
    async ({ entityType, agentId, teamId, dbId }: LoaderArgs) => {
      const selectedId = entityType === 'agent' ? agentId : teamId
      if (!selectedEndpoint || !entityType || !selectedId || !dbId) return

      try {
        setIsSessionsLoading(true)

        const sessions = await getAllSessionsAPI(
          selectedEndpoint,
          entityType,
          selectedId,
          dbId,
          authToken
        )
        setSessionsData(sessions.data ?? [])
      } catch {
        toast.error('Error loading sessions')
        setSessionsData([])
      } finally {
        setIsSessionsLoading(false)
      }
    },
    [selectedEndpoint, authToken, setSessionsData, setIsSessionsLoading]
  )

  const getSession = useCallback(
    async (
      { entityType, agentId, teamId, dbId }: LoaderArgs,
      sessionId: string
    ) => {
      const selectedId = entityType === 'agent' ? agentId : teamId
      if (
        !selectedEndpoint ||
        !sessionId ||
        !entityType ||
        !selectedId ||
        !dbId
      )
        return

      try {
        const response: unknown = await getSessionAPI(
          selectedEndpoint,
          entityType,
          sessionId,
          dbId,
          authToken
        )
        if (response && Array.isArray(response)) {
          const messagesFor = response.flatMap((rawRun) => {
            const run = rawRun as SessionRunResponse
            const filteredMessages: ChatMessage[] = []

            filteredMessages.push({
              role: 'user',
              content: run.run_input ?? '',
              created_at: run.created_at
            })

            const toolCalls = [
              ...(run.tools ?? []),
              ...(run.extra_data?.reasoning_messages ?? []).reduce(
                (acc: ToolCall[], msg: ReasoningMessage) => {
                  if (msg.role === 'tool') {
                    acc.push({
                      role: msg.role,
                      content: msg.content,
                      tool_call_id: msg.tool_call_id ?? '',
                      tool_name: msg.tool_name ?? '',
                      tool_args: msg.tool_args ?? {},
                      tool_call_error: msg.tool_call_error ?? false,
                      metrics: msg.metrics ?? { time: 0 },
                      created_at: msg.created_at ?? Math.floor(Date.now() / 1000)
                    })
                  }
                  return acc
                },
                []
              )
            ]

            const embeds = mergeEmbeds(
              mergeEmbeds(
                parseEmbeds(run.extra_data?.embeds),
                parseEmbeds(run.metadata?.embeds)
              ),
              parseEmbeds(run.session_state?.metabase_embeds)
            )

            filteredMessages.push({
              role: 'agent',
              content: (run.content as string) ?? '',
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              extra_data: {
                ...run.extra_data,
                embeds: embeds.length > 0 ? embeds : run.extra_data?.embeds
              },
              images: run.images,
              videos: run.videos,
              audio: run.audio,
              response_audio: run.response_audio,
              created_at: run.created_at
            })

            return filteredMessages
          })

          const processedMessages = messagesFor.map((message: ChatMessage) => {
            if (Array.isArray(message.content)) {
              const textContent = message.content
                .filter((item: { type: string }) => item.type === 'text')
                .map((item) => item.text)
                .join(' ')

              return {
                ...message,
                content: textContent
              }
            }
            if (typeof message.content !== 'string') {
              return {
                ...message,
                content: getJsonMarkdown(message.content)
              }
            }
            return message
          })

          setMessages(processedMessages)
          return processedMessages
        }
      } catch {
        return null
      }
    },
    [selectedEndpoint, authToken, setMessages]
  )

  return { getSession, getSessions }
}

export default useSessionLoader
