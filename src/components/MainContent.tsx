import React from 'react'

export function MainContent() {
  return (
    <>
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Перейти к основному содержимому
      </a>
      
      <main 
        id="main-content"
        className="min-h-[calc(100vh-8rem)] sm:min-h-[calc(100vh-10rem)] flex items-center justify-center px-4" 
        role="main"
      >
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light mb-4 text-neutral-900 dark:text-white tracking-tight">
            Здесь будет ваше приложение <span className="text-blue-500">:)</span>
          </h1>
          
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Опишите свою идею, и Харви создаст его для вас
          </p>
        </div>
      </main>
    </>
  )
}
