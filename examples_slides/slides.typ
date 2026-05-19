
#import "template.typ": *

#show: presentation

#title-slide[
  #text(fill: white, size: 1.3em, weight: "bold")[Presentation Title]

  #text(fill: white, size: 0.8em, weight: "semibold")[
    #v(0.5em)
    Presented by Author
  ]


  #speaker-notes[
    Speaker Notes For Slide 1
  ]

]

#slide[
  = Test slide 123

  #only("1-")[
    This is a citation to a Model @vaswani2023attentionneed
  ]

  #only("2-")[
    This is a comment that is only visible on slide 2
  ]

]

#slide[
  = Media demo Embedded


  #only("2-")[
    #media("figures/demo.gif", width: 60%)
  ]

]
#slide[
  = Mp4 demo


  #media("figures/big-buck-bunny-1080p-30sec.mp4", width: 70%)

]

#slide[
  = Media demo (URL)

  #media(
    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif",
    width: 40%,
    //poster: "figures/rotating_earth_poster.png",
    aspect-ratio: 1,
  )
]


#slide[
  #bibliography(
    "bibliography.bib",
    style: "apa",
  )
]
