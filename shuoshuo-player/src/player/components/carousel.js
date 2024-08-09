// Example from: https://www.embla-carousel.com/examples/predefined

import React, { useState, useCallback, useEffect } from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay';
import PropTypes from 'prop-types';

const usePrevNextButtons = (emblaApi) => {
    const [prevBtnDisabled, setPrevBtnDisabled] = useState(true)
    const [nextBtnDisabled, setNextBtnDisabled] = useState(true)

    const onPrevButtonClick = useCallback(() => {
        if (!emblaApi) return
        emblaApi.scrollPrev()
    }, [emblaApi])

    const onNextButtonClick = useCallback(() => {
        if (!emblaApi) return
        emblaApi.scrollNext()
    }, [emblaApi])

    const onSelect = useCallback((emblaApi) => {
        setPrevBtnDisabled(!emblaApi.canScrollPrev())
        setNextBtnDisabled(!emblaApi.canScrollNext())
    }, [])

    useEffect(() => {
        if (!emblaApi) return

        onSelect(emblaApi)
        emblaApi.on('reInit', onSelect).on('select', onSelect)
    }, [emblaApi, onSelect])

    return {
        prevBtnDisabled,
        nextBtnDisabled,
        onPrevButtonClick,
        onNextButtonClick
    }
}

const PrevButton = (props) => {
    const { children, ...restProps } = props

    return (
        <button
            className="embla__button embla__button--prev"
            type="button"
            {...restProps}
        >
            <svg className="embla__button__svg" viewBox="0 0 532 532">
                <path
                    fill="currentColor"
                    d="M355.66 11.354c13.793-13.805 36.208-13.805 50.001 0 13.785 13.804 13.785 36.238 0 50.034L201.22 266l204.442 204.61c13.785 13.805 13.785 36.239 0 50.044-13.793 13.796-36.208 13.796-50.002 0a5994246.277 5994246.277 0 0 0-229.332-229.454 35.065 35.065 0 0 1-10.326-25.126c0-9.2 3.393-18.26 10.326-25.2C172.192 194.973 332.731 34.31 355.66 11.354Z"
                />
            </svg>
            {children}
        </button>
    )
}

const NextButton = (props) => {
    const { children, ...restProps } = props

    return (
        <button
            className="embla__button embla__button--next"
            type="button"
            {...restProps}
        >
            <svg className="embla__button__svg" viewBox="0 0 532 532">
                <path
                    fill="currentColor"
                    d="M176.34 520.646c-13.793 13.805-36.208 13.805-50.001 0-13.785-13.804-13.785-36.238 0-50.034L330.78 266 126.34 61.391c-13.785-13.805-13.785-36.239 0-50.044 13.793-13.796 36.208-13.796 50.002 0 22.928 22.947 206.395 206.507 229.332 229.454a35.065 35.065 0 0 1 10.326 25.126c0 9.2-3.393 18.26-10.326 25.2-45.865 45.901-206.404 206.564-229.332 229.52Z"
                />
            </svg>
            {children}
        </button>
    )
}

const useDotButton = (emblaApi) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [scrollSnaps, setScrollSnaps] = useState([])

    const onDotButtonClick = useCallback(
        (index) => {
            if (!emblaApi) return
            emblaApi.scrollTo(index)
        },
        [emblaApi]
    )

    const onInit = useCallback((emblaApi) => {
        setScrollSnaps(emblaApi.scrollSnapList())
    }, [])

    const onSelect = useCallback((emblaApi) => {
        setSelectedIndex(emblaApi.selectedScrollSnap())
    }, [])

    useEffect(() => {
        if (!emblaApi) return

        onInit(emblaApi)
        onSelect(emblaApi)
        emblaApi.on('reInit', onInit).on('reInit', onSelect).on('select', onSelect)
    }, [emblaApi, onInit, onSelect])

    return {
        selectedIndex,
        scrollSnaps,
        onDotButtonClick
    }
}

const DotButton = (props) => {
    const { children, ...restProps } = props

    return (
        <button type="button" {...restProps}>
            {children}
        </button>
    )
}

const VideoAlbumCarousel = (props) => {
    const { slides = [] } = props;
    const [emblaRef, emblaApi] = useEmblaCarousel({loop: true}, [Autoplay()])

    const { selectedIndex, scrollSnaps, onDotButtonClick } =
        useDotButton(emblaApi)

    const {
        prevBtnDisabled,
        nextBtnDisabled,
        onPrevButtonClick,
        onNextButtonClick
    } = usePrevNextButtons(emblaApi)

    return <section className="video-album-carousel embla theme-dark">
        <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container">
                {slides.map((item, index) => (
                    <div className="embla__slide" key={index}>
                        <div className="embla__slide__card" onClick={() => item.onClick && item.onClick()}>
                            <div className="embla__slide__image">
                                <div className="embla__slide__image__cover">
                                    <OpenInNewIcon />
                                </div>
                                <img alt={item.title} src={item.pic}/>
                            </div>
                            <div className="embla__slide__title">{item.title}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="embla__controls">
        <div className="embla__buttons">
                <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled}/>
                <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled}/>
            </div>

            <div className="embla__dots">
                {scrollSnaps.map((_, index) => (
                    <DotButton
                        key={index}
                        onClick={() => onDotButtonClick(index)}
                        className={'embla__dot'.concat(
                            index === selectedIndex ? ' embla__dot--selected' : ''
                        )}
                    />
                ))}
            </div>
        </div>
    </section>
};

VideoAlbumCarousel.propTypes = {
    slides: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string.isRequired,
        pic: PropTypes.string.isRequired,
        onClick: PropTypes.func,
    }))
}

export default VideoAlbumCarousel