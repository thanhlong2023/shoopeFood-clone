import React from 'react'

interface ErrorModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title = 'Rất tiếc!',
  message,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl transform transition-all flex flex-col items-center text-center scale-100 opacity-100 animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          {message}
        </p>
        
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-red-100"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  )
}
