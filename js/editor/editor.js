/*globals define*/
define(function( require ) {
  'use strict';

  var Box2D = require( 'box2d' );
  var BaseObject = require( 'base-object' );
  var Color = require( 'color' );
  var Polygon = require( 'geometry/polygon' );
  var GeometryFactory = require( 'geometry/geometry-factory' );
  var Intersection = require( 'geometry/intersection' );
  var Material = require( 'config/material' );
  var Utils = require( 'utils' );
  var Box2DUtils = require( 'utils-box2d' );

  var PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;

  var PI2 = Utils.PI2;
  var DEFAULT_LINE_WIDTH = 4;

  var fills = {
    DEFAULT: [ 0, 0, 0, 0.5 ],
    HIGHLIGHT: [],
    DEBUG: [ 255, 0, 0, 1 ]
  };

  var strokes = {
    DEFAULT: [ 255, 255, 255, 1.0 ]
  };

  var vertexRadius = 10;

  // Convert arrays in the Colors object to objects with RGBA values.
  (function() {
    function arrayToColorObject( colors ) {
      var color;
      var red, green, blue, alpha;
      for ( var key in colors ) {
        color = colors[ key ];
        red   = color[0];
        green = color[1];
        blue  = color[2];
        alpha = color[3];

        colors[ key ] = new Color( red, green, blue, alpha );
      }
    }

    arrayToColorObject( fills );
    arrayToColorObject( strokes );
  }) ();

    /**
   * Rounds a value to the given precision, removes any trailing zeros produced
   * by Number.prototype.toFixed().
   *
   * Example:
   *   var x = 100;
   *   x.toFixed(2); // "100.00"
   *   round( 100, 2 ); // "100"
   */
  function round( value, precision ) {
    return parseFloat( value.toFixed( precision ) );
  }

  // Utility class to allow for Polygon vertex transforms.
  function Vertex( polygon, index ) {
    BaseObject.call( this );
    this.polygon = polygon;
    this.index = index;
  }

  Vertex.prototype = new BaseObject();
  Vertex.prototype.constructor = Vertex;

  Vertex.prototype.draw = function( ctx, radius ) {
    ctx.beginPath();

    var point = this.toWorld();
    ctx.arc( point.x, point.y, radius, 0, PI2 );

    ctx.fillStyle = fills.DEBUG.rgba();
    ctx.fill();

    ctx.strokeStyle = strokes.DEFAULT.rgba();
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.stroke();
  };

  Vertex.prototype.toWorld = function() {
    return this.polygon.toWorld( this.x, this.y );
  };

  Vertex.prototype.toLocal = function( x, y ) {
    return this.polygon.toLocal( x, y );
  };

  Object.defineProperty( Vertex.prototype, 'x', {
    get: function() {
      return this.polygon.vertices[ 2 * this.index ];
    },

    set: function( x ) {
      this.polygon.vertices[ 2 * this.index ] = x;
    }
  });

  Object.defineProperty( Vertex.prototype, 'y', {
    get: function() {
      return this.polygon.vertices[ 2 * this.index + 1 ];
    },

    set: function( y ) {
      this.polygon.vertices[ 2 * this.index + 1 ] = y;
    }
  });

  /**
   * Return false if no vertices contain the point.
   *
   * Otherwise, return an object containing a vertices array, which consists of
   * Vertex objects containing a reference to the polygon and the vertex index,
   * and an offsets array.
   */
  Polygon.prototype.verticesContain = function( x, y, radius ) {
    var vertexCount = this.vertexCount();

    var px = x,
        py = y;

    var point = this.toLocal( x, y );
    x = point.x;
    y = point.y;

    var vertices = [];
    var radiusSquared = radius * radius;

    var xi, yi;
    for ( var i = 0; i < vertexCount; i++ ) {
      xi = this.vertices[ 2 * i ];
      yi = this.vertices[ 2 * i + 1 ];

      if ( Utils.distanceSquared( x, y, xi, yi ) < radiusSquared ) {
        vertices.push( new Vertex( this, i ) );
      }
    }

    if ( !vertices.length ) {
      return null;
    }

    // Get world space coordinates of vertices.
    var offsets = [];
    vertices.forEach(function( vertex ) {
      point = vertex.toWorld();
      xi = point.x;
      yi = point.y;

      offsets.push({
        x: xi - px,
        y: yi - py
      });
    }.bind( this ));

    return {
      vertices: vertices,
      offsets: offsets
    };
  };

  Polygon.prototype.drawVertices = function( ctx ) {
    var vertexCount = this.vertexCount();

    ctx.fillStyle = fills.DEFAULT.rgba();
    ctx.strokeStyle = strokes.DEFAULT.rgba();
    ctx.lineWidth = DEFAULT_LINE_WIDTH;

    var x, y;
    for ( var i = 0; i < vertexCount; i++ ) {
      x = this.vertices[ 2 * i ];
      y = this.vertices[ 2 * i + 1 ];

      ctx.beginPath();
      ctx.arc( x, y, vertexRadius, 0, PI2 );
      ctx.fill();
      ctx.stroke();
    }
  };

  Polygon.prototype.drawPosition = function( ctx ) {
    ctx.beginPath();
    ctx.arc( 0, 0, 5, 0, PI2 );
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fill();
  };

  // Mixin vertices drawing.
  (function() {
    var normalOptions = {
      length: 20,
      lineWidth: 3,
      stroke: '#0a0'
    };

    var drawPathFn = Polygon.prototype.drawPath;
    Polygon.prototype.drawPath = function( ctx ) {
      this.drawVertices( ctx );
      this.drawNormals( ctx, normalOptions );
      this.drawPosition( ctx );
      drawPathFn.call( this, ctx );
    };
  }) ();

  function Editor( options ) {
    options = options || {};

    var ids = {
      el: options.el || '#editor',
      scaleEl: options.scaleEl || '#scale',
      historyEl: options.historyEl || '#history'
    };

    [ 'el', 'scaleEl', 'historyEl' ].forEach(function( key ) {
      this[ key ] = document.querySelector( ids[ key ] );
      if ( !this[ key ] ) {
        this[ key ] = document.createElement( 'div' );
        this[ key ].id = ids[ key ];
      }
    }.bind( this ));

    this.storage = window.sessionStorage;
    this.updateHistory();

    this.canvas = document.createElement( 'canvas' );
    this.ctx    = this.canvas.getContext( '2d' );

    this.canvas.width  = options.width  || 640;
    this.canvas.height = options.height || 480;

    this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';

    this.el.appendChild( this.canvas );

    this.textarea = document.createElement( 'textarea' );
    this.textarea.rows = 10;

    this.el.appendChild( this.textarea );

    this.elements = [];

    this.selection = [];
    this.offsets = [];

    this.mouse = {
      x: 0,
      y: 0,

      down: false
    };

    this.keys = [];

    this.translate = {
      x: 0.5 * this.canvas.width,
      y: 0.5 * this.canvas.height
    };

    this.snapping = true;
    this.snappingRadius = 15;

    this.canvas.addEventListener( 'mousedown', this.onMouseDown.bind( this ) );
    this.canvas.addEventListener( 'mousemove', this.onMouseMove.bind( this ) );
    this.canvas.addEventListener( 'mouseup', this.onMouseUp.bind( this ) );
  }

  Editor.prototype.asEntities = function() {
    var string = '';

    string += this.entities.map(function( entity ) {
      return JSON.stringify( entity );
    }).join( ', ');

    return string;
  };

  Editor.prototype.asPhysicsEntities = function( scale ) {
    scale = scale || 1;

    var string = '[';

    string += this.elements.map(function( element ) {
      var vertices = element.vertices.map(function( component ) {
        return round( component * scale, 2 );
      });

      return JSON.stringify({
        shape: 'polygon',
        type: 'vector',
        data: vertices,
        fixture: {
          density: 1.0,
          friction: 0.5,
          restitution: 0.2,
          filter: {
            categoryBits: Material.BIMATTER
          }
        },
        body: {
          type: 'static',
          position: {
            x: round( element.x * scale, 2 ),
            y: round( element.y * scale, 2 )
          },
          angle: round( element.angle, 3 )
        },
        shapes: [
          {
            type: element.type,
            vertices: vertices,
            fill: {
              type: 'color',
              alpha: 1
            }
          }
        ]
      });
    }).join( ', ' );

    string += ']';

    this.save();

    return string;
  };

  Editor.prototype.mousePosition = function( event ) {
    this.mouse.x = event.pageX - this.canvas.offsetLeft - this.translate.x;
    this.mouse.y = event.pageY - this.canvas.offsetTop  - this.translate.y;
  };

  Editor.prototype.onMouseDown = function( event ) {
    this.mousePosition( event );
    this.mouse.down = true;

    // A. Add shape.
    if ( this.keys[ 65 ] ) {
      var polygon = new Polygon();
      polygon.x = this.mouse.x;
      polygon.y = this.mouse.y;
      polygon.vertices = [ 100, 50, -100, 50, 0, -100 ];
      this.add( polygon );
      this.draw();
      return;
    }

    // D. Remove shape.
    if ( this.keys[ 68 ] ) {
      var removed = [];
      this.elements.forEach(function( element ) {
        if ( element.contains( this.mouse.x, this.mouse.y ) ) {
          removed.push( element );
        }
      }.bind( this ));

      removed.forEach(function( element ) {
        this.remove( element );
      }.bind( this ));
      this.draw();
      return;
    }

    // Add vertex.
    if ( this.keys[ 86 ] ) {
      var minDistanceSquared = Number.POSITIVE_INFINITY,
          minElement, minIndex;

      var mouse;
      var x, y;

      var vertexCount;
      var xi, yi, xj, yj;
      this.elements.forEach(function( element ) {
        if ( element.type === 'polygon' ) {
          // Transform mouse x, y to element coords.
          mouse = element.toLocal( this.mouse.x, this.mouse.y );
          x = mouse.x;
          y = mouse.y;

          vertexCount = element.vertexCount();

          // Find the segment with minimal distance to the point.
          for ( var i = 0; i < vertexCount; i++ ) {
            xi = element.vertices[ 2 * i ];
            yi = element.vertices[ 2 * i + 1 ];
            xj = element.vertices[ 2 * ( ( i + 1 ) % vertexCount ) ];
            yj = element.vertices[ 2 * ( ( i + 1 ) % vertexCount ) + 1 ];

            // Since we don't change scale at all, distances are okay.
            var point = Intersection.closestPointOnSegment( x, y, xi, yi, xj, yj );
            var distanceSquared = Utils.distanceSquared( x, y, point.x, point.y );
            if ( distanceSquared < minDistanceSquared ) {
              minDistanceSquared = distanceSquared;
              minElement = element;
              minIndex = i;
            }
          }
        }
      }.bind( this ));

      var mx, my;
      if ( minElement ) {
        vertexCount = minElement.vertexCount();

        xi = minElement.vertices[ 2 * minIndex ];
        yi = minElement.vertices[ 2 * minIndex + 1 ];
        xj = minElement.vertices[ 2 * ( ( minIndex + 1 ) % vertexCount ) ];
        yj = minElement.vertices[ 2 * ( ( minIndex + 1 ) % vertexCount ) + 1 ];

        mx = 0.5 * ( xi + xj );
        my = 0.5 * ( yi + yj );

        minElement.vertices.splice( 2 * ( ( minIndex + 1 ) % vertexCount ), 0, mx, my );
      }

      this.draw();
      return;
    }

    // Remove vertices.
    if ( event.altKey ) {
      this.elements.forEach(function( element ) {
        if ( element.type === 'polygon' ) {
          var vertices = element.verticesContain( this.mouse.x, this.mouse.y, vertexRadius );
          if ( vertices ) {
            vertices.vertices.sort(function( a, b ) {
              return a.index - b.index;
            });

            vertices.vertices.forEach(function( vertex ) {
              if ( element.vertexCount() > 3 ) {
                element.vertices.splice( 2 * vertex.index + 1, 1 );
                element.vertices.splice( 2 * vertex.index, 1 );
              } else {
                console.log( 'Minimum vertex count for polygon reached.' );
              }
            });
          }
        }
      }.bind( this ));

      this.draw();
      return;
    }

    // Select shape.
    this.elements.forEach(function( element ) {
      if ( element.type === 'polygon' ) {
        var vertices = element.verticesContain( this.mouse.x, this.mouse.y, vertexRadius );
        if ( vertices ) {
          this.selection = this.selection.concat( vertices.vertices );
          this.offsets = this.offsets.concat( vertices.offsets );
          return;
        }
      }

      if ( element.contains( this.mouse.x, this.mouse.y ) ) {
        this.selection.push( element );
        this.offsets.push({
          x: element.x - this.mouse.x,
          y: element.y - this.mouse.y
        });
      }
    }.bind( this ));
  };

  Editor.prototype.onMouseMove = function( event ) {
    this.mousePosition( event );

    // Move selection.
    if ( this.selection.length ) {
      this.selection.forEach(function( element, index ) {
        var offset = this.offsets[ index ];

        var x = this.mouse.x + offset.x,
            y = this.mouse.y + offset.y;

        // Handle snapping.
        var point;
        var localPoint;
        // World coordinates of the vertex.
        var wx, wy;

        var minDistanceSquared = Number.POSITIVE_INFINITY,
            distanceSquared;

        var minElement, minIndex;
        if ( this.snapping && element.type === 'vertex' ) {
          point = element.toWorld( x, y );
          wx = point.x;
          wy = point.y;

          // Get closest point.
          this.elements.forEach(function( other ) {
            if ( other.type === 'polygon' && other !== element.polygon ) {
              localPoint = other.toLocal( wx, wy );

              for ( var i = 0, il = other.vertexCount(); i < il; i++ ) {
                distanceSquared = Utils.distanceSquared(
                  localPoint.x, localPoint.y,
                  other.vertices[ 2 * i ], other.vertices[ 2 * i + 1 ]
                );

                if ( distanceSquared < minDistanceSquared ) {
                  minDistanceSquared = distanceSquared;
                  minElement = other;
                  minIndex = i;
                }
              }
            }
          }.bind( this ));

          // Snap to closest vertex.
          if ( minDistanceSquared < this.snappingRadius ) {
            point = minElement.toWorld(
              minElement.vertices[ 2 * minIndex ],
              minElement.vertices[ 2 * minIndex + 1 ]
            );

            x = point.x;
            y = point.y;
          }
        }

        // Convert transformed vertex coordinates to polygon space.
        if ( element.type === 'vertex' ) {
          point = element.toLocal( x, y );
          x = point.x;
          y = point.y;
        }

        element.x = x;
        element.y = y;
      }.bind( this ));
    } else if ( !this.mouse.down ) {
      // Otherwise, hover over selection.
      var ctx = this.ctx;

      this.elements.forEach(function( element ) {
        if ( element.type === 'polygon' ) {
          var vertices = element.verticesContain( this.mouse.x, this.mouse.y, vertexRadius );

          if ( vertices ) {
            vertices.vertices.forEach(function( vertex ) {
              vertex.draw( ctx, vertexRadius );
            });
          }
        }
      }.bind( this ));
    } else if ( !this.selection.length && this.mouse.down ) {
      // Pan.
      this.translate.x += event.webkitMovementX;
      this.translate.y += event.webkitMovementY;
    }

    this.draw();
  };

  Editor.prototype.onMouseUp = function() {
    this.mouse.down = false;

    this.clearSelection();
  };

  Editor.prototype.onKeyDown = function( event ) {
    this.keys[ event.which ] = true;

    // Spacebar.
    if ( event.which === 32 ) {
      var data = this.asPhysicsEntities( parseFloat( this.scaleEl.value ) );

      console.log( data );
      this.textarea.value = data;
    }

    // R. Reset view.
    if ( event.which === 82 ) {
      this.translate.x = 0.5 * this.canvas.width;
      this.translate.y = 0.5 * this.canvas.height;
      this.draw();
    }

    // Alt+P. Recenter all polygon elements.
    if ( event.which === 80 && event.altKey ) {
      event.preventDefault();

      this.elements.forEach(function( element ) {
        if ( element.type !== 'polygon' ) {
          return;
        }

        var vertices = Box2DUtils.b2Vec2Array( element.vertices );
        var centroid = PolygonShape.ComputeCentroid( vertices, vertices.length );

        var dx = centroid.x,
            dy = centroid.y;

        var vertexCount = element.vertexCount();
        for ( var i = 0; i < vertexCount; i++ ) {
          element.vertices[ 2 * i ] -= dx;
          element.vertices[ 2 * i + 1 ] -= dy;
        }

        // Rotate centroid to world space.
        var cos, sin;
        var rdx, rdy;
        if ( element.angle ) {
          cos = Math.cos( -element.angle );
          sin = Math.sin( -element.angle );

          rdx = cos * dx - sin * dy;
          rdy = sin * dx + cos * dy;

          dx = rdx;
          dy = rdy;
        }

        element.x += dx;
        element.y += dy;
      });

      this.draw();
    }
  };

  Editor.prototype.onKeyUp = function( event ) {
    this.keys[ event.which ] = false;
  };

  Editor.prototype.draw = function() {
    var ctx = this.ctx;

    var width  = ctx.canvas.width,
        height = ctx.canvas.height;

    ctx.clearRect( 0, 0, width, height );

    ctx.save();
    ctx.translate( this.translate.x, this.translate.y );

    this.drawGrid( 16 );
    this.drawPlayerScale( 3 );

    this.elements.forEach(function( element ) {
      element.draw( ctx );
    });

    // Now highlight whatever we've selected.
    this.selection.forEach(function( element ) {
      if ( element.type === 'vertex' ) {
        element.draw( ctx, vertexRadius );
      }
    });

    ctx.restore();
  };

  Editor.prototype.drawGrid = function( spacing ) {
    var ctx = this.ctx;

    var width  = ctx.canvas.width,
        height = ctx.canvas.height;

    var halfWidth  = 0.5 * width,
        halfHeight = 0.5 * height;

    var xCount = width / spacing,
        yCount = height / spacing;

    ctx.beginPath();

    var i;
    // Vertical lines.
    for ( i = 0; i <= xCount; i++ ) {
      ctx.moveTo( i * spacing - halfWidth, -halfHeight );
      ctx.lineTo( i * spacing - halfWidth,  halfHeight );
    }

    // Horizontal lines.
    for ( i = 0; i <= yCount; i++ ) {
      ctx.moveTo( -halfWidth, i * spacing - halfHeight );
      ctx.lineTo(  halfWidth, i * spacing - halfHeight );
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#222';
    ctx.stroke();

    // Draw center lines.
    ctx.beginPath();

    // Vertical.
    ctx.moveTo( 0, -halfHeight );
    ctx.lineTo( 0,  halfHeight );

    // Horizontal.
    ctx.moveTo( -halfWidth, 0 );
    ctx.lineTo(  halfWidth, 0 );

    ctx.lineWidth = 1;
    ctx.stroke();
  };

  Editor.prototype.drawPlayerScale = function( playerRadius ) {
    var ctx = this.ctx;

    ctx.beginPath();
    ctx.arc( 0, 0, playerRadius / this.scale, 0, PI2 );
    ctx.fillStyle = '#222';
    ctx.fill();
  };

  Editor.prototype.add = function( element ) {
    if ( element.fill && element.stroke ) {
      element.fill.set( fills.DEFAULT );
      element.stroke.set( strokes.DEFAULT );
      element.lineWidth = DEFAULT_LINE_WIDTH;
    }

    this.elements.push( element );
  };

  Editor.prototype.remove = function( element ) {
    var index = this.elements.indexOf( element );
    if ( index !== -1 ) {
      this.elements.splice( index, 1 );
    }
  };

  Editor.prototype.save = function() {
    var date = new Date();

    this.storage.setItem( date.toString(), JSON.stringify( this.elements ) );
    this.updateHistory();
  };

  /**
   * Takes a string of element data.
   */
  Editor.prototype.load = function( data ) {
    this.clear();

    JSON.parse( data ).forEach(function( elementData ) {
      this.elements.push( GeometryFactory.create( JSON.stringify( elementData ) ) );
    }.bind( this ));

    this.draw();
  };

  Editor.prototype.loadSelected = function() {
    var selectedIndex = this.historyEl.selectedIndex;
    if ( selectedIndex === -1 ) {
      return;
    }

    var key = this.storage.key( selectedIndex );
    this.load( this.storage.getItem( key ) );
  };

  Editor.prototype.removeSelected = function() {
    var selectedIndex = this.historyEl.selectedIndex;
    if ( selectedIndex === -1 ) {
      return;
    }

    var key = this.storage.key( selectedIndex );
    this.storage.removeItem( key );
    this.updateHistory();
  };

  Editor.prototype.clear = function() {
    this.elements = [];
    this.clearSelection();
  };

  Editor.prototype.clearSelection = function() {
    this.selection = [];
    this.offsets = [];
  };

  Editor.prototype.updateHistory = function() {
    var historyEl = this.historyEl;

    var optionFragment = document.createDocumentFragment();
    Object.keys( this.storage ).forEach(function( key, index ) {
      var optionEl = document.createElement( 'option' );
      optionEl.value = index;
      optionEl.innerHTML = key;
      optionFragment.appendChild( optionEl );
    });

    historyEl.innerHTML = '';
    historyEl.appendChild( optionFragment );
  };

  Editor.prototype.clearHistory = function() {
    if ( window.confirm( 'Clear history?' ) ) {
      this.storage.clear();
      this.updateHistory();
    }
  };

  Object.defineProperty( Editor.prototype, 'scale', {
    get: function() {
      return parseFloat( this.scaleEl.value ) || 1;
    }
  });

  return Editor;
});
