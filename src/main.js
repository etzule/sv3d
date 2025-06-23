import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

gi// Variabel utama
let scene, camera, renderer, controls, meshes = [], thickness = 5;
const originalRotation = new THREE.Euler(0, 0, 0);

// Ambil ukuran panel kanan
const getPanelSize = () => {
    const p = document.querySelector('.right-panel');
    return [p ? p.clientWidth : window.innerWidth, p ? p.clientHeight : window.innerHeight * 0.8];
};
const getAspect = () => { let [w, h] = getPanelSize(); return w / h; };

// Inisialisasi scene, kamera, renderer, controls, dan event
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    camera = new THREE.PerspectiveCamera(90, getAspect(), 0.1, 1000);
    camera.position.set(0, 0, 100);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, preserveDrawingBuffer: true });
    
    let [w, h] = getPanelSize();
    renderer.setSize(w, h);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.25;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    let dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1); scene.add(dirLight);
    animate();

    // Event handler
    document.getElementById('svg-file').addEventListener('change', handleSVGFile);
    document.getElementById('export-btn').addEventListener('click', exportSTL);
    document.getElementById('thickness').addEventListener('input', e => {
        thickness = parseFloat(e.target.value);
        document.getElementById('thickness-value').textContent = thickness;
        let svgText = document.getElementById('svg-preview').innerHTML;
        if (svgText && svgText.includes('<svg')) processSVG(svgText);
    });
    window.addEventListener('resize', onWindowResize);
}

// Handler file SVG
function handleSVGFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => processSVG(evt.target.result);
    reader.readAsText(file);
}

// Proses SVG ke objek 3D
function processSVG(svgText) {
    meshes.forEach(m => scene.remove(m)); meshes = [];
    document.getElementById('svg-preview').innerHTML = svgText;
    const loader = new SVGLoader();
    const svgData = loader.parse(svgText);

    // flatMap: semua path jadi mesh array, hanya warna solid
    meshes = svgData.paths.flatMap(path =>
        SVGLoader.createShapes(path).map(shape => {
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
            geometry.center();
            // Tidak ada material tekstur, hanya warna solid
            const material = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.copy(originalRotation);
            scene.add(mesh);
            return mesh;
        })
    );
    document.getElementById('info').textContent = '';
    if (meshes.length) focusCameraOnObject(meshes[0]);
}

// Fokus kamera ke objek 3D
function focusCameraOnObject(obj) {
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    let cameraZ = Math.max(size.x, size.y, size.z) * 2;
    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center); controls.update();
}

// Export objek 3D ke STL
function exportSTL() {
    if (!meshes.length) return alert('Tidak ada objek 3D untuk diekspor');
    const group = new THREE.Group();
    meshes.forEach(mesh => group.add(mesh.clone()));

    const exporter = new STLExporter();
    const stlString = exporter.parse(group, { binary: false });
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url; link.download = 'model.stl';
    document.body.appendChild(link); link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
}

// Resize handler
function onWindowResize() {
    camera.aspect = getAspect();
    camera.updateProjectionMatrix();
    let [w, h] = getPanelSize();
    renderer.setSize(w, h);
}

// Loop animasi utama
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Jalankan inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', init);