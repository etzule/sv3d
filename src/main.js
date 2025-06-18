import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

// Variabel global utama
let scene, camera, renderer, controls, meshes = [];
// Rotasi awal objek agar berdiri tegak dan tampak depan
let originalRotation = new THREE.Euler(0, 0, 0); // Rotasi 0 agar berdiri dan tampak depan
let thickness = 5;

// Inisialisasi scene, kamera, renderer, controls, dan event
function init() {
    // Buat scene Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Buat kamera perspektif
    camera = new THREE.PerspectiveCamera(90, getAspectRatio(), 0.1, 1000);
    camera.position.set(0, 0, 100); // Kamera menghadap sumbu Z positif

    // Buat renderer dan pasang ke canvas
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(getCanvasWidth(), getCanvasHeight());

    // OrbitControls untuk navigasi 3D
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    // Tambahkan pencahayaan
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    // Mulai animasi render loop
    animate();

    // Event handler untuk file SVG
    document.getElementById('svg-file').addEventListener('change', handleSVGFile);
    // Event handler untuk export STL
    document.getElementById('export-btn').addEventListener('click', exportSTL);
    // Event handler untuk slider ketebalan
    document.getElementById('thickness').addEventListener('input', function(e) {
        thickness = parseFloat(e.target.value);
        document.getElementById('thickness-value').textContent = thickness;
        // Jika sudah ada SVG, update preview 3D secara otomatis
        const svgText = document.getElementById('svg-preview').innerHTML;
        if (svgText && svgText.includes('<svg')) {
            processSVG(svgText);
        }
    });

    // Event handler untuk resize window
    window.addEventListener('resize', onWindowResize);
}

// Mendapatkan lebar canvas dari panel kanan
function getCanvasWidth() {
    const panel = document.querySelector('.right-panel');
    return panel ? panel.clientWidth : window.innerWidth;
}

// Mendapatkan tinggi canvas dari panel kanan
function getCanvasHeight() {
    const panel = document.querySelector('.right-panel');
    return panel ? panel.clientHeight : window.innerHeight * 0.8;
}

// Mendapatkan rasio aspek canvas
function getAspectRatio() {
    return getCanvasWidth() / getCanvasHeight();
}

// Handler saat file SVG dipilih
function handleSVGFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => processSVG(evt.target.result);
    reader.readAsText(file);
}

// Proses parsing SVG dan konversi ke objek 3D
function processSVG(svgText) {
    // Hapus mesh lama dari scene
    meshes.forEach(m => scene.remove(m));
    meshes = [];

    // Tampilkan preview SVG di panel kiri
    document.getElementById('svg-preview').innerHTML = svgText;

    // Parsing SVG menjadi data path
    const loader = new SVGLoader();
    const svgData = loader.parse(svgText);

    // Cek jika ada elemen <image> di SVG untuk tekstur
    const svgDoc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const imageElem = svgDoc.querySelector('image');
    let texture = null;

    // Jika ada <image>, load sebagai tekstur
    if (imageElem) {
        let imgSrc = imageElem.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || imageElem.getAttribute('href');
        if (imgSrc) {
            const texLoader = new THREE.TextureLoader();
            texture = texLoader.load(imgSrc);
        }
    }

    // Untuk setiap path pada SVG, buat shape dan extrude ke 3D
    svgData.paths.forEach(path => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach(shape => {
            // Extrude shape menjadi geometry 3D
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: thickness,
                bevelEnabled: false,
                steps: 1
            });
            geometry.center(); // Pusatkan geometry di tengah

            // Pilih material: dengan tekstur jika ada, jika tidak pakai warna solid
            let material;
            if (texture) {
                material = new THREE.MeshPhongMaterial({ map: texture, side: THREE.DoubleSide });
            } else {
                material = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.DoubleSide });
            }

            // Buat mesh dari geometry dan material
            const mesh = new THREE.Mesh(geometry, material);

            // Atur rotasi agar objek berdiri dan tampak depan
            mesh.rotation.copy(originalRotation);

            // Tambahkan mesh ke scene dan simpan ke array
            scene.add(mesh);
            meshes.push(mesh);
        });
    });

    // Kosongkan info jika ada
    document.getElementById('info').textContent = '';
    // Fokus kamera ke objek jika ada
    if (meshes.length) focusCameraOnObject(meshes[0]);
}

// Fokus kamera ke objek 3D agar selalu terlihat di tengah
function focusCameraOnObject(obj) {
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    let cameraZ = Math.max(size.x, size.y, size.z) * 2;
    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center);
    controls.update();
}

// Export objek 3D ke file STL
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

// Handler saat window di-resize
function onWindowResize() {
    camera.aspect = getAspectRatio();
    camera.updateProjectionMatrix();
    renderer.setSize(getCanvasWidth(), getCanvasHeight());
}

// Loop animasi utama
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Jalankan inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', init);