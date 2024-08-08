import React from 'react';
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

const VideoAlbumCarousel = () => {
    const [emblaRef] = useEmblaCarousel({ loop: false }, [Autoplay()])
    return <div className="video-album-carousel embla" ref={emblaRef}>
        <div className="embla__container">
            <div className="embla__slide">Slide 1</div>
            <div className="embla__slide">Slide 2</div>
            <div className="embla__slide">Slide 3</div>
        </div>
    </div>;
};

export default VideoAlbumCarousel