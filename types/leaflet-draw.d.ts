import 'leaflet'

declare module 'leaflet' {
  namespace Draw {
    interface Event {
      CREATED: string
      EDITED: string
      DELETED: string
      DRAWSTART: string
      DRAWSTOP: string
      DRAWVERTEX: string
      EDITSTART: string
      EDITMOVE: string
      EDITRESIZE: string
      EDITVERTEX: string
      EDITSTOP: string
      DELETESTART: string
      DELETESTOP: string
    }
  }

  namespace Control {
    class Draw extends Control {
      constructor(options?: DrawConstructorOptions)
    }
  }

  interface DrawConstructorOptions {
    position?: ControlPosition
    draw?: DrawOptions
    edit?: EditOptions
  }

  interface DrawOptions {
    polyline?: PolylineOptions | false
    polygon?: PolygonOptions | false
    rectangle?: RectangleOptions | false
    circle?: CircleOptions | false
    marker?: MarkerOptions | false
    circlemarker?: CircleMarkerOptions | false
  }

  interface PolygonOptions {
    allowIntersection?: boolean
    drawError?: {
      color?: string
      message?: string
    }
    shapeOptions?: PathOptions
    showArea?: boolean
    metric?: boolean | string[]
    feet?: boolean
    nautic?: boolean
    repeatMode?: boolean
  }

  interface EditOptions {
    featureGroup?: FeatureGroup
    remove?: boolean
    edit?: boolean | {
      selectedPathOptions?: PathOptions
    }
  }
}
