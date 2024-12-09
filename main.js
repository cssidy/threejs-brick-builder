import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';

let camera, scene, renderer;
let plane;
let pointer, raycaster, isShiftDown = false;

let rollOverGeo, rollOverMesh, rollOverMaterial;
let blockGeo, blockMaterial;
let cylinderGeo;
let block_width = 50;
let block_depth = 50;
let block_height = 50;

const objects = [];

const block_widths = [50, 150];
const block_depths = [50, 100, 150];

let current_block_color = "crimson";
const block_colors = [
    "crimson", "orange", "tomato", "hotpink", "lime", "yellow", "lawngreen",
    "lightseagreen", "aqua", "gold", "skyblue", "dodgerblue", "coral",
    "deepskyblue", "cornflowerblue", "darkorchid", "saddlebrown",
    "rosybrown", "floralwhite", "dimgray"
];

function init() {
    camera = new THREE.PerspectiveCamera( 28, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.set( 800, 800, 1000 );
    camera.lookAt( 0, 0, 0 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( "rgb(228, 229, 236)" );


    // cylinders on top of blocks
    cylinderGeo = new THREE.CylinderGeometry( 8, 8, 8, 20);

    // roll-over helpers
    rollOverGeo = new THREE.BoxGeometry( block_width, block_height, block_depth );
    rollOverMaterial = new THREE.MeshBasicMaterial( { color: current_block_color, opacity: 0.5, transparent: true } );
    rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
    scene.add( rollOverMesh );

    // grid
    const gridHelper = new THREE.GridHelper( 1000, 20 );
    scene.add( gridHelper );

    // pointers
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const geometry = new THREE.PlaneGeometry( 1000, 1000 );
    geometry.rotateX( - Math.PI / 2 );

    plane = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { visible: false } ) );
    scene.add( plane );

    objects.push( plane );

    // lights
    const ambientLight = new THREE.AmbientLight( 0x606060, 3 );
    scene.add( ambientLight );

    const directionalLight = new THREE.DirectionalLight( 0xffffff, 3 );
    directionalLight.position.set( 1, 0.75, 0.5 ).normalize();
    scene.add( directionalLight );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    let canvasContainer = document.querySelector(".canvas-container");
    canvasContainer.appendChild( renderer.domElement );

    document.addEventListener( 'pointermove', onPointerMove );
    document.addEventListener( 'pointerdown', onPointerDown );
    document.addEventListener( 'keydown', onDocumentKeyDown );
    document.addEventListener( 'keyup', onDocumentKeyUp );

    window.addEventListener( 'resize', onWindowResize );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}

function onPointerMove(event) {
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];

        // adjust the snapping logic based on the size of the brick
        rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);

        const snapX = block_width / 2;
        const snapZ = block_depth / 2;

        // snap the block to the grid based on its size (width and depth)
        rollOverMesh.position.divideScalar(50).floor().multiplyScalar(50);
        rollOverMesh.position.x += snapX;
        rollOverMesh.position.z += snapZ;
        rollOverMesh.position.y += 25; // Keeps it on the grid's top plane

        render();
    }
}

function onPointerDown( event ) {
    pointer.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );
    raycaster.setFromCamera( pointer, camera );
    const intersects = raycaster.intersectObjects( objects, false );

    if (intersects.length > 0) {
        const intersect = intersects[0];

        // calculate bounding box for the new block
        const newBlockPosition = rollOverMesh.position.clone();
        const newBlockBox = new THREE.Box3().setFromObject(rollOverMesh);

        // check if there's any overlap with existing blocks
        let isOverlapping = false;
        const tolerance = 0.01;  // allow small tolerance to let bricks touch
        const toleranceHeight = 10; // tolerance for stacking bricks vertically

        for (let i = 0; i < objects.length; i++) {
            if (objects[i] !== plane) {
                const existingBox = new THREE.Box3().setFromObject(objects[i]);

                // Check if bounding boxes actually overlap, ignoring slight touches (tolerance)
                if (
                    newBlockBox.min.x < existingBox.max.x - tolerance &&
                    newBlockBox.max.x > existingBox.min.x + tolerance &&
                    newBlockBox.min.y < existingBox.max.y - toleranceHeight &&
                    newBlockBox.max.y > existingBox.min.y + toleranceHeight &&
                    newBlockBox.min.z < existingBox.max.z - tolerance &&
                    newBlockBox.max.z > existingBox.min.z + tolerance
                ) {
                    isOverlapping = true;
                    break;
                }
            }
        }

        // only place the block if it is not overlapping with any existing blocks
        if (!isOverlapping) {
            placeBlock(intersect);
        } else {
            console.log("Cannot place the block: it overlaps with another block.");
        }

        render();
    }
}

function placeBlock(intersect) {
    // create new block
    blockMaterial = new THREE.MeshLambertMaterial({ color: current_block_color });
    blockGeo = new THREE.BoxGeometry(block_width, block_height, block_depth);
    const block = new THREE.Mesh(blockGeo, blockMaterial);

    const studsCountX = block_width / 50; // Number of studs along the width
    const studsCountZ = block_depth / 50; // Number of studs along the depth

    // cylinder geometry for studs
    const cylinderGeo = new THREE.CylinderGeometry(15, 15, 10, 32);

    // add studs on top of the block
    for (let i = 0; i < studsCountX; i++) {
        for (let j = 0; j < studsCountZ; j++) {
            const cylinder = new THREE.Mesh(cylinderGeo, blockMaterial);

            const studX = (i * 50) - (block_width / 2) + 25;
            const studY = block_height / 2 + 5;
            const studZ = (j * 50) - (block_depth / 2) + 25;

            cylinder.position.set(studX, studY, studZ);
            block.add(cylinder);
        }
    }

    // position the block, snapping to grid based on size
    const snapX = block_width / 2;
    const snapZ = block_depth / 2;

    block.position.copy(intersect.point).add(intersect.face.normal);
    block.position.divideScalar(50).floor().multiplyScalar(50);
    block.position.x += snapX;
    block.position.z += snapZ;
    block.position.y += 25;

    // randomly change to a new block shape
    block_width = block_widths[Math.floor(Math.random() * block_widths.length)];
    block_depth = block_depths[Math.floor(Math.random() * block_depths.length)];

    // create new rollover
    current_block_color = block_colors[Math.floor(Math.random() * block_colors.length)];
    scene.remove(rollOverMesh);
    rollOverGeo = new THREE.BoxGeometry(block_width, block_height, block_depth);
    rollOverMaterial = new THREE.MeshBasicMaterial({ color: current_block_color, opacity: 0.5, transparent: true });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    scene.add(block);
    objects.push(block);
}

if ( WebGL.isWebGL2Available() ) {
    init();
    render();
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById( 'container' ).appendChild( warning );
}

function onDocumentKeyDown( event ) {
    switch ( event.keyCode ) {
        case 16: isShiftDown = true; break;
    }
}

function onDocumentKeyUp( event ) {
    switch ( event.keyCode ) {
        case 16: isShiftDown = false; break;
    }
}

function render() {
    renderer.render( scene, camera );
}