import { useState } from 'react'
import { Check, X, MessageSquare } from 'lucide-react'

interface SuggestionCardProps {
  original: string
  suggestion: string
  reasoning?: string
  onAccept: () => void
  onReject: () => void
  onRefine: (comment: string) => void
  isLoading?: boolean
}

export function SuggestionCard({
  original,
  suggestion,
  reasoning,
  onAccept,
  onReject,
  onRefine,
  isLoading,
}: SuggestionCardProps) {
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')

  const handleRefine = () => {
    if (comment.trim()) {
      onRefine(comment.trim())
      setComment('')
      setShowComment(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{
        background: '#141416',
        border: '1px solid #2b2b2f',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #c4913a',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ color: '#8a8680', fontSize: '13px' }}>AI is thinking...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#141416',
      border: '1px solid #c4913a',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#c4913a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          Improved Version
        </div>
        <div style={{
          background: '#0c0c0d',
          border: '1px solid #2b2b2f',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '14px',
          lineHeight: 1.6,
        }}>
          {suggestion}
        </div>
      </div>

      {reasoning && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#6a6660', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Why this is better
          </div>
          <div style={{ fontSize: '12px', color: '#8a8680', lineHeight: 1.5 }}>
            {reasoning}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#6a6660', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Original
        </div>
        <div style={{
          background: 'rgba(248,113,113,0.05)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '14px',
          color: '#6a6660',
          lineHeight: 1.6,
          textDecoration: 'line-through',
        }}>
          {original}
        </div>
      </div>

      {showComment ? (
        <div style={{ marginTop: '12px' }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What would you like to change?"
            style={{
              width: '100%',
              background: '#0c0c0d',
              border: '1px solid #2b2b2f',
              borderRadius: '8px',
              color: '#edeae2',
              fontFamily: 'inherit',
              fontSize: '13px',
              padding: '10px 12px',
              minHeight: '80px',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowComment(false)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                background: '#1a1a1d',
                color: '#8a8680',
                border: '1px solid #2b2b2f',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRefine}
              disabled={!comment.trim()}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: comment.trim() ? 'pointer' : 'not-allowed',
                background: comment.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)',
                color: '#0c0c0d',
                border: 'none',
              }}
            >
              Refine
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={onAccept}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: '#4ade80',
              color: '#0c0c0d',
              border: 'none',
            }}
          >
            <Check size={16} />
            Accept
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              color: '#f87171',
              border: '1px solid #f87171',
            }}
          >
            <X size={16} />
            Reject
          </button>
          <button
            onClick={() => setShowComment(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#1a1a1d',
              color: '#8a8680',
              border: '1px solid #2b2b2f',
            }}
          >
            <MessageSquare size={16} />
            Refine
          </button>
        </div>
      )}

    </div>
  )
}