import React, { useEffect, useState, useCallback } from 'react'
import slideStore from '@/features/stores/slide'
import homeStore from '@/features/stores/home'
import { speakMessageHandler } from '@/features/chat/handlers'
import SlideContent from './slideContent'
import SlideControls from './slideControls'

interface SlidesProps {
  markdown: string
}

export const goToSlide = (index: number) => {
  slideStore.setState({
    currentSlide: index,
  })
}

const Slides: React.FC<SlidesProps> = ({ markdown }) => {
  const [marpitContainer, setMarpitContainer] = useState<Element | null>(null)
  const isPlaying = slideStore((state) => state.isPlaying)
  const currentSlide = slideStore((state) => state.currentSlide)
  const selectedSlideDocs = slideStore((state) => state.selectedSlideDocs)
  const chatProcessingCount = homeStore((s) => s.chatProcessingCount)
  const [slideCount, setSlideCount] = useState(0)

  useEffect(() => {
    const currentMarpitContainer = document.querySelector('.marpit')
    if (!currentMarpitContainer) return
    const slides = currentMarpitContainer.querySelectorAll(':scope > svg')

    slides.forEach((slide, i) => {
      if (i === currentSlide) {
        // 表示するスライド
        slide.removeAttribute('hidden')
        slide.setAttribute('style', 'display: block;')

        // 新しく表示されるスライド内の video を再生
        const videos = slide.querySelectorAll('video') as NodeListOf<HTMLVideoElement>
        videos.forEach((video) => {
          //video.muted = true
          video.play().catch((err) => {
            console.warn('Video autoplay failed:', err)
          })
        })
      } else {
        // 非表示にするスライド
        slide.setAttribute('hidden', '')
        slide.setAttribute('style', 'display: none;')

        // 非表示になったスライド内の video を停止
        // TODO: video一時停止するとplay()がエラーで動かないため一度流したら止めないで対応した
        const videos = slide.querySelectorAll('video') as NodeListOf<HTMLVideoElement>
        videos.forEach((video) => {
          //video.pause()
          //video.currentTime = 0 // 最初に巻き戻したい場合は指定
        })
      }
    })
  }, [currentSlide, marpitContainer])

  useEffect(() => {
    const convertMarkdown = async () => {
      const response = await fetch('/api/convertMarkdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slideName: selectedSlideDocs }),
      })
      const data = await response.json()

      // HTMLをパースしてmarpit要素を取得
      const parser = new DOMParser()
      const doc = parser.parseFromString(data.html, 'text/html')
      const marpitElement = doc.querySelector('.marpit')
      setMarpitContainer(marpitElement)

      // スライド数を設定
      if (marpitElement) {
        const slides = marpitElement.querySelectorAll(':scope > svg')
        setSlideCount(slides.length)

        // 初期状態で最初のスライド以外は非表示にしておく
        slides.forEach((slide, i) => {
          if (i === 0) {
            slide.removeAttribute('hidden')
            slide.setAttribute('style', 'display: block;')
          } else {
            slide.setAttribute('hidden', '')
            slide.setAttribute('style', 'display: none;')
          }
        })
      }

      // CSSを動的に適用
      const styleElement = document.createElement('style')
      styleElement.textContent = data.css
      document.head.appendChild(styleElement)

      return () => {
        document.head.removeChild(styleElement)
      }
    }

    convertMarkdown()
  }, [selectedSlideDocs])

  useEffect(() => {
    // カスタムCSSを適用
    const customStyle = `
      div.marpit > svg > foreignObject > section {
        padding: 2em;
      }
    `
    const styleElement = document.createElement('style')
    styleElement.textContent = customStyle
    document.head.appendChild(styleElement)

    // コンポーネントのアンマウント時にスタイルを削除
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  const readSlide = useCallback(
    (slideIndex: number) => {
      const getCurrentLines = () => {
        const scripts = require(
          `../../public/slides/${selectedSlideDocs}/scripts.json`
        )
        const currentScript = scripts.find(
          (script: { page: number }) => script.page === slideIndex
        )
        return currentScript ? currentScript.line : ''
      }

      const currentLines = getCurrentLines()
      console.log(currentLines)
      speakMessageHandler(currentLines)
    },
    [selectedSlideDocs]
  )

  const nextSlide = useCallback(() => {
    slideStore.setState((state) => {
      const newSlide = Math.min(state.currentSlide + 1, slideCount - 1)
      if (isPlaying) {
        readSlide(newSlide)
      }
      return { currentSlide: newSlide }
    })
  }, [isPlaying, readSlide, slideCount])

  useEffect(() => {
    // 最後のスライドに達した場合、isPlayingをfalseに設定
    if (currentSlide === slideCount - 1 && chatProcessingCount === 0) {
      slideStore.setState({ isPlaying: false })
    }
  }, [currentSlide, slideCount, chatProcessingCount])

  const prevSlide = useCallback(() => {
    slideStore.setState((state) => ({
      currentSlide: Math.max(state.currentSlide - 1, 0),
    }))
  }, [])

  const toggleIsPlaying = () => {
    const newIsPlaying = !isPlaying
    slideStore.setState({
      isPlaying: newIsPlaying,
    })
    if (newIsPlaying) {
      readSlide(currentSlide)
    }
  }

  useEffect(() => {
    if (
      chatProcessingCount === 0 &&
      isPlaying &&
      currentSlide < slideCount - 1
    ) {
      nextSlide()
    }
  }, [chatProcessingCount, isPlaying, nextSlide, currentSlide, slideCount])

  return (
    <>
      <div
        className="absolute"
        style={{
          width: '80vw',
          height: 'calc(80vw * (9 / 16))',
          top: 'calc((100vh - 80vw * (9 / 16)) / 2)',
          right: 0,
          left: 0,
          margin: 'auto',
        }}
      >
        <SlideContent marpitContainer={marpitContainer} />
      </div>
      <div
        className="absolute"
        style={{
          width: '80vw',
          top: 'calc((100vh + 80vw * (7 / 16)) / 2)',
          right: 0,
          left: 0,
          margin: 'auto',
          zIndex: 10,
        }}
      >
        <SlideControls
          currentSlide={currentSlide}
          slideCount={slideCount}
          isPlaying={isPlaying}
          prevSlide={prevSlide}
          nextSlide={nextSlide}
          toggleIsPlaying={toggleIsPlaying}
        />
      </div>
    </>
  )
}
export default Slides
