import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

let scene, camera, renderer, controls, meshes = [];
let originalRotation = new THREE.Euler(-Math.PI / 2, 0, 0);

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(75, getAspectRatio(), 0.1, 1000);
    camera.position.set(0, 0, 100);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(getCanvasWidth(), getCanvasHeight());

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    animate();

    document.getElementById('svg-file').addEventListener('change', handleSVGFile);
    document.getElementById('export-btn').addEventListener('click', exportSTL);
    window.addEventListener('resize', onWindowResize);
}

function getCanvasWidth() {
    const panel = document.querySelector('.right-panel');
    return panel ? panel.clientWidth : window.innerWidth;
}
function getCanvasHeight() {
    const panel = document.querySelector('.right-panel');
    return panel ? panel.clientHeight : window.innerHeight * 0.8;
}
function getAspectRatio() {
    return getCanvasWidth() / getCanvasHeight();
}

function handleSVGFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => processSVG(evt.target.result);
    reader.readAsText(file);
}

function processSVG(svgText) {
    // Bersihkan mesh lama
    meshes.forEach(m => scene.remove(m));
    meshes = [];

    // Preview SVG
    document.getElementById('svg-preview').innerHTML = svgText;

    // Parsing SVG
    const loader = new SVGLoader();
    const svgData = loader.parse(svgText);

    // Cek jika ada <image> di SVG untuk tekstur
    const svgDoc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const imageElem = svgDoc.querySelector('image');
    let texture = null;

    if (imageElem) {
        let imgSrc = imageElem.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || imageElem.getAttribute('href');
        if (imgSrc) {
            const texLoader = new THREE.TextureLoader();
            texture = texLoader.load(imgSrc);
        }
    }

    svgData.paths.forEach(path => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach(shape => {
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: 5,
                bevelEnabled: false,
                steps: 1
            });
            geometry.center();
            let material;
            if (texture) {
                material = new THREE.MeshPhongMaterial({ map: texture, side: THREE.DoubleSide });
            } else {
                material = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.DoubleSide });
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.copy(originalRotation);
            scene.add(mesh);
            meshes.push(mesh);
        });
    });

    document.getElementById('info').textContent = '';
    if (meshes.length) focusCameraOnObject(meshes[0]);
}

function focusCameraOnObject(obj) {
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    let cameraZ = Math.max(size.x, size.y, size.z) * 2;
    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center);
    controls.update();
}

function exportSTL() {
    if (!meshes.length) return alert('Tidak ada objek 3D untuk diekspor');
    const group = new THREE.Group();
    meshes.forEach(mesh => group.add(mesh.clone()));
    const exporter = new STLExporter();
    const stlString = exporter.parse(group, { binary: false });
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'model.stl';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
}

function onWindowResize() {
    camera.aspect = getAspectRatio();
    camera.updateProjectionMatrix();
    renderer.setSize(getCanvasWidth(), getCanvasHeight());
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', init);