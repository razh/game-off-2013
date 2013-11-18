/* globals requirejs, define*/
requirejs.config({
  shim: {
    box2d: {
      exports: 'Box2D'
    }
  },
  paths: {
    box2d: 'Box2dWeb/Box2dWeb-2.1.a.3.min'
  }
});

define(function( require ) {
  'use strict';

  var Game    = require( 'game' ),
      Level   = require( 'level' ),
      Circle  = require( 'geometry/circle' ),
      Rect    = require( 'geometry/rect' ),
      Polygon = require( 'geometry/polygon' ),
      Segment = require( 'geometry/segment' ),
      Player  = require( 'entities/player' );

  var Entity = require( 'entities/entity' );

  var Emitter = require( 'entities/emitter' );
  var TractorBeam = require( 'entities/tractor-beam' );

  var game = Game.instance = new Game();
  game.level = new Level();
  game.level.fill.set({
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1.0
  });

  // Circle.
  var circleEntity = new Entity();

  var circle = new Circle( 10, 20, 5 );
  circle.fill.alpha = 0.5;

  circleEntity.add( circle );
  game.add( circleEntity );

  // Rect.
  var rectEntity = new Entity( 30, 5 );

  var rect = new Rect( 0, 0, 5, 10 );
  rect.fill.alpha = 0.5;

  rectEntity.add( rect );
  game.add( rectEntity );

  var rectInterval = setInterval(function() {
    rectEntity.x -= 0.4;
    rectEntity.angle += 10 * Math.PI / 180;
    polyEntity.angle += 2 * Math.PI / 180;
    segmentEntity.angle -= 2 * Math.PI / 180;
  }, 16 );

  setTimeout(function() {
    clearInterval( rectInterval );
  }, 600 );

  // Polygon.
  var polyEntity = new Entity( 50, 35 );

  var polygon = new Polygon( 5, 0 );
  polygon.vertices = [ -5, 3, 5, 3, 0, -5 ];
  polygon.fill.alpha = 0.5;

  polyEntity.add( polygon );
  game.add( polyEntity );

  // Segment.
  var segmentEntity = new Entity();
  segmentEntity.x = 20;
  segmentEntity.y = 35;

  var segment = new Segment(0, 0, 10, 5 );
  segment.stroke.alpha = 1;
  segment.lineWidth = 0.2;

  segmentEntity.add( segment );
  game.add( segmentEntity );

  // Tractor beam.
  var tractorBeam = new TractorBeam( 20, 30, 5 );
  tractorBeam.distance = 20;
  tractorBeam.force = 1500;
  game.add( tractorBeam );

  // Factory test.
  var GeometryFactory = require( 'geometry/geometry-factory' );
  var polygonClone =  GeometryFactory.create( JSON.stringify( polygon ) );
  if ( JSON.stringify( polygon ) !== JSON.stringify( polygonClone ) ) {
    console.log( 'GeometryFactory clone failed.' );
  }

  // Emitter.
  var emitter = new Emitter( 25, 20 );
  var emitterPolygon = new Polygon( 0, 0 );
  emitterPolygon.vertices = [ -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5 ];
  emitterPolygon.stroke.set({
    red: 255,
    alpha: 1
  });
  emitterPolygon.lineWidth = 0.2;
  emitter.rate = 500;
  emitter.lifeTime = 2000;
  emitter.speed = 100;
  emitter.angle = -0.5 * Math.PI;
  emitter.particle = emitterPolygon;
  emitter.world = game;
  emitter.start( 500 );

  // Player.
  game.player = new Player( 20, 20 );
  game.player.world = game;
  game.player.add( new Circle( 0, 0, 2 ) );
  game.player.shapes[0].fill.alpha = 0.5;

  game.add( game.player );

  game.camera.target = game.player;

  game.element.classList.add( 'game' );
  document.body.insertBefore( game.element, document.body.firstChild );

  // Setup input.
  var input = game.input;

  document.addEventListener( 'keydown', input.onKeyDown.bind( input ) );
  document.addEventListener( 'keyup', input.onKeyUp.bind( input ) );

  if ( typeof window.ontouchstart !== 'undefined' ) {
    game.canvas.addEventListener( 'touchstart', input.onTouchStart.bind( input ) );
    game.canvas.addEventListener( 'touchmove', input.onTouchMove.bind( input ) );
    game.canvas.addEventListener( 'touchend', input.onTouchEnd.bind( input ) );
  }

  // Start game.
  game.tick();

  // Add a checkbox to toggle continuous rendering,
  var runCheckbox = document.getElementById( 'run-checkbox' );
  function play() {
    game.running = true;
    game.tick();
    runCheckbox.checked = true;
  }

  function pause() {
    game.running = false;
    runCheckbox.checked = false;
  }

  function toggleContinuousRendering() {
    if ( !runCheckbox.checked ) {
      play();
    } else {
      pause();
    }
  }

  runCheckbox.addEventListener( 'click', function() {
    // Hacky. Since play() and pause() change the checked state, we need to
    // toggle the checkbox state to back before it was clicked.
    runCheckbox.checked = !runCheckbox.checked;
    toggleContinuousRendering();
  });

  document.addEventListener( 'keydown', function( event ) {
    // R.
    if ( event.which === 82 ) {
      toggleContinuousRendering( event );
    }
  });

  window.addEventListener( 'blur', pause );

  setTimeout(function() {
    game.running = false;
  }, 500 );
});
