
'use client';

import React from 'react';

const ResponsiveYoutubeEmbed = ({ embedId }: { embedId: string }) => (
  <div className="relative overflow-hidden w-full" style={{ paddingTop: "56.25%" }}>
    <iframe
      className="absolute top-0 left-0 bottom-0 right-0 w-full h-full"
      src={`https://www.youtube.com/embed/${embedId}`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Embedded youtube"
      loading="lazy"
    />
  </div>
);

export default ResponsiveYoutubeEmbed;
