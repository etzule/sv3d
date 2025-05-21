import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; 
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

// Variabel global
let scene, camera, renderer, controls, extrudeMesh;
let originalRotation = new THREE.Euler(-Math.PI / 2, 0, 0); // Rotasi default seperti sebelumnya
let db; // Database reference

// Inisialisasi Three.js scene
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, getAspectRatio(), 0.1, 1000);
    camera.position.z = 5;
    
    // Renderer
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        preserveDrawingBuffer: true
    });
    updateRendererSize();
    
    // Kontrol orbit
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Pencahayaan
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Grid helper (dalam milimeter untuk skala nyata)
    const gridHelper = new THREE.GridHelper(100, 100);
    scene.add(gridHelper);
    
    // Axis helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);
    
    // Event listeners
    setupEventListeners();
    
    // Initialize database
    initDatabase();
    
    // Animasi
    animate();
}

// Initialize IndexedDB
function initDatabase() {
    const request = indexedDB.open('SVG3DConverterDB', 1);
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('conversions')) {
            db.createObjectStore('conversions', { keyPath: 'id', autoIncrement: true });
        }
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database initialized');
    };
    
    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
    };
}

// Save conversion to database
function saveToDatabase() {
    if (!extrudeMesh) {
        alert('Tidak ada objek 3D untuk disimpan');
        return;
    }

    const svgFileInput = document.getElementById('svg-file');
    if (!svgFileInput.files.length) {
        alert('Tidak ada file SVG yang dipilih');
        return;
    }

    const file = svgFileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const svgData = e.target.result;
        const fileName = file.name;
        const date = new Date().toISOString();

        const settings = {
            extrudeDepth: parseFloat(document.getElementById('extrude-depth').value),
            bevelEnabled: document.getElementById('bevel-enabled').value === 'true',
            bevelSize: parseFloat(document.getElementById('bevel-size').value),
            bevelThickness: parseFloat(document.getElementById('bevel-thickness').value),
            color: document.getElementById('color').value,
            rotationX: parseFloat(document.getElementById('rotation-x').value),
            rotationY: parseFloat(document.getElementById('rotation-y').value),
            rotationZ: parseFloat(document.getElementById('rotation-z').value)
        };

        // Kirim data ke server
        fetch('api/save_conversion.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                svgData,
                settings: JSON.stringify(settings),
                date
            })
        })
        .then(response => response.json())
        .then(data => alert(data.success ? 'Tersimpan di server!' : 'Gagal menyimpan'))
        .catch(error => console.error('Error:', error));
    };

    reader.readAsText(file);
}

// Load history from database
function loadHistory() {
    const transaction = db.transaction(['conversions'], 'readonly');
    const store = transaction.objectStore('conversions');
    const request = store.getAll();
    
    request.onsuccess = (event) => {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        const records = event.target.result;
        if (records.length === 0) {
            historyList.innerHTML = '<p>Tidak ada riwayat konversi</p>';
            return;
        }
        
        records.forEach(record => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <strong>${record.fileName}</strong>
                <div>${new Date(record.date).toLocaleString()}</div>
            `;
            
            item.addEventListener('click', () => {
                loadFromRecord(record);
                document.getElementById('history-panel').classList.add('hidden');
            });
            
            historyList.appendChild(item);
        });
    };
    
    request.onerror = (event) => {
        console.error('Error loading history:', event.target.error);
    };
}

// Load from database record
function loadFromRecord(record) {
    // Set UI controls from record
    document.getElementById('extrude-depth').value = record.settings.extrudeDepth;
    document.getElementById('depth-value').textContent = record.settings.extrudeDepth;
    
    document.getElementById('bevel-enabled').value = record.settings.bevelEnabled ? 'true' : 'false';
    document.getElementById('bevel-size').disabled = !record.settings.bevelEnabled;
    document.getElementById('bevel-thickness').disabled = !record.settings.bevelEnabled;
    
    document.getElementById('bevel-size').value = record.settings.bevelSize;
    document.getElementById('bevel-size-value').textContent = record.settings.bevelSize;
    
    document.getElementById('bevel-thickness').value = record.settings.bevelThickness;
    document.getElementById('bevel-thickness-value').textContent = record.settings.bevelThickness;
    
    document.getElementById('color').value = record.settings.color;
    
    document.getElementById('rotation-x').value = record.settings.rotationX;
    document.getElementById('rotation-y').value = record.settings.rotationY;
    document.getElementById('rotation-z').value = record.settings.rotationZ;
    
    // Process SVG data
    processSVG(record.svgData);
    
    // Update file info
    document.getElementById('file-info').textContent = `File: ${record.fileName}`;
    
    // Create a fake file object for the input
    const blob = new Blob([record.svgData], { type: 'image/svg+xml' });
    const file = new File([blob], record.fileName, { type: 'image/svg+xml' });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('svg-file').files = dataTransfer.files;
}

// Dapatkan aspect ratio berdasarkan ukuran viewport
function getAspectRatio() {
    const viewer = document.getElementById('viewer');
    return viewer.clientWidth / viewer.clientHeight;
}

// Update ukuran renderer
function updateRendererSize() {
    const viewer = document.getElementById('viewer');
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Setup event listeners
function setupEventListeners() {
    // File upload
    const fileInput = document.getElementById('svg-file');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Extrusion depth
    const depthSlider = document.getElementById('extrude-depth');
    const depthValue = document.getElementById('depth-value');
    depthSlider.addEventListener('input', () => {
        depthValue.textContent = depthSlider.value;
    });
    
    // Bevel controls
    const bevelEnabled = document.getElementById('bevel-enabled');
    const bevelSize = document.getElementById('bevel-size');
    const bevelThickness = document.getElementById('bevel-thickness');
    
    bevelEnabled.addEventListener('change', () => {
        const enabled = bevelEnabled.value === 'true';
        bevelSize.disabled = !enabled;
        bevelThickness.disabled = !enabled;
    });
    
    // Bevel size
    const bevelSizeValue = document.getElementById('bevel-size-value');
    bevelSize.addEventListener('input', () => {
        bevelSizeValue.textContent = bevelSize.value;
    });
    
    // Bevel thickness
    const bevelThicknessValue = document.getElementById('bevel-thickness-value');
    bevelThickness.addEventListener('input', () => {
        bevelThicknessValue.textContent = bevelThickness.value;
    });
    
    // Rotation controls
    const rotationX = document.getElementById('rotation-x');
    const rotationY = document.getElementById('rotation-y');
    const rotationZ = document.getElementById('rotation-z');
    
    [rotationX, rotationY, rotationZ].forEach(input => {
        input.addEventListener('input', updateObjectRotation);
    });
    
    // Reset rotation button
    document.getElementById('reset-rotation').addEventListener('click', () => {
        rotationX.value = 0;
        rotationY.value = 0;
        rotationZ.value = 0;
        updateObjectRotation();
    });
    
    // Convert button
    document.getElementById('convert-btn').addEventListener('click', convertSVGto3D);
    
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', resetScene);
    
    // Export button
    document.getElementById('export-btn').addEventListener('click', exportSTL);
    
    // Save to database button
    document.getElementById('save-to-db-btn').addEventListener('click', saveToDatabase);
    
    // View history button
    document.getElementById('view-history-btn').addEventListener('click', () => {
        document.getElementById('history-panel').classList.remove('hidden');
        loadHistory();
    });
    
    // Close history button
    document.getElementById('close-history-btn').addEventListener('click', () => {
        document.getElementById('history-panel').classList.add('hidden');
    });
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
}

// Update object rotation based on UI controls
function updateObjectRotation() {
    if (!extrudeMesh) return;
    
    const rotationX = document.getElementById('rotation-x').value;
    const rotationY = document.getElementById('rotation-y').value;
    const rotationZ = document.getElementById('rotation-z').value;
    
    // Convert degrees to radians
    const xRad = THREE.MathUtils.degToRad(parseFloat(rotationX));
    const yRad = THREE.MathUtils.degToRad(parseFloat(rotationY));
    const zRad = THREE.MathUtils.degToRad(parseFloat(rotationZ));
    
    // Apply rotation while preserving the original rotation
    extrudeMesh.rotation.x = originalRotation.x + xRad;
    extrudeMesh.rotation.y = originalRotation.y + yRad;
    extrudeMesh.rotation.z = originalRotation.z + zRad;
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileInfo = document.getElementById('file-info');
    fileInfo.textContent = `File: ${file.name}`;
}

// Convert SVG to 3D
function convertSVGto3D() {
    const fileInput = document.getElementById('svg-file');
    if (!fileInput.files.length) {
        alert('Silakan pilih file SVG terlebih dahulu');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const svgData = e.target.result;
        processSVG(svgData);
    };
    
    reader.readAsText(file);
}

// Process SVG data
function processSVG(svgData) {
    // Hapus objek 3D sebelumnya jika ada
    if (extrudeMesh) {
        scene.remove(extrudeMesh);
    }
    
    // Parse SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgData, 'image/svg+xml');
    const paths = doc.querySelectorAll('path');
    
    if (paths.length === 0) {
        alert('Tidak menemukan path SVG yang valid');
        return;
    }
    
    // Buat bentuk dari path SVG
    const shapes = [];
    paths.forEach(path => {
        const shape = new THREE.Shape();
        const pathData = path.getAttribute('d');
        
        // Parsing sederhana untuk path SVG
        const commands = pathData.match(/[a-df-z][^a-df-z]*/gi);
        
        if (!commands) return;
        
        commands.forEach(command => {
            const type = command[0];
            const args = command.substr(1).trim().split(/[\s,]+/).map(parseFloat);
            
            switch(type.toLowerCase()) {
                case 'm': // moveTo
                    if (args.length >= 2) {
                        shape.moveTo(args[0], -args[1]); // Flip Y axis untuk koordinat Three.js
                    }
                    break;
                case 'l': // lineTo
                    if (args.length >= 2) {
                        shape.lineTo(args[0], -args[1]);
                    }
                    break;
                case 'c': // curveTo
                    if (args.length >= 6) {
                        shape.bezierCurveTo(
                            args[0], -args[1],
                            args[2], -args[3],
                            args[4], -args[5]
                        );
                    }
                    break;
                case 'z': // closePath
                    shape.closePath();
                    break;
            }
        });
        
        shapes.push(shape);
    });
    
    // Parameter ekstrusi
    const extrudeSettings = {
        depth: parseFloat(document.getElementById('extrude-depth').value),
        bevelEnabled: document.getElementById('bevel-enabled').value === 'true',
        bevelThickness: parseFloat(document.getElementById('bevel-thickness').value),
        bevelSize: parseFloat(document.getElementById('bevel-size').value),
        bevelSegments: 3,
        steps: 1
    };
    
    // Buat geometri
    const geometry = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
    
    // Pusatkan geometri
    geometry.center();
    
    // Skala ke milimeter (asumsi 1 unit = 1mm untuk kompatibilitas printer 3D)
    const scale = 1;
    geometry.scale(scale, scale, scale);
    
    // Material
    const color = document.getElementById('color').value;
    const material = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(color),
        specular: 0x111111,
        shininess: 30,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });
    
    // Mesh dengan rotasi default seperti sebelumnya (X -90 derajat)
    extrudeMesh = new THREE.Mesh(geometry, material);
    extrudeMesh.rotation.copy(originalRotation);
    scene.add(extrudeMesh);
    
    // Reset UI rotation controls
    document.getElementById('rotation-x').value = 0;
    document.getElementById('rotation-y').value = 0;
    document.getElementById('rotation-z').value = 0;
    
    // Fokus kamera ke objek
    focusCameraOnObject(extrudeMesh);
}

// Focus camera on object
function focusCameraOnObject(object) {
    const bbox = new THREE.Box3().setFromObject(object);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    
    // Hitung jarak kamera berdasarkan ukuran objek
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
    
    // Beri sedikit ruang ekstra
    cameraZ *= 1.5;
    
    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center);
    controls.update();
}

// Reset scene
function resetScene() {
    if (extrudeMesh) {
        scene.remove(extrudeMesh);
        extrudeMesh = null;
    }
    
    document.getElementById('svg-file').value = '';
    document.getElementById('file-info').textContent = 'Tidak ada file dipilih';
    
    // Reset rotation controls
    document.getElementById('rotation-x').value = 0;
    document.getElementById('rotation-y').value = 0;
    document.getElementById('rotation-z').value = 0;
    
    camera.position.set(0, 0, 100);
    controls.target.set(0, 0, 0);
    controls.update();
}

// Export as STL
function exportSTL() {
    if (!extrudeMesh) {
        alert('Tidak ada objek 3D untuk diekspor');
        return;
    }
    
    // Buat klon dari mesh untuk ekspor (tanpa material)
    const meshForExport = extrudeMesh.clone();
    
    // Gabungkan rotasi default dengan rotasi tambahan dari UI
    const rotationX = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotation-x').value));
    const rotationY = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotation-y').value));
    const rotationZ = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotation-z').value));
    
    meshForExport.rotation.x = originalRotation.x + rotationX;
    meshForExport.rotation.y = originalRotation.y + rotationY;
    meshForExport.rotation.z = originalRotation.z + rotationZ;
    
    meshForExport.updateMatrixWorld();
    
    // Ekspor ke STL
    const exporter = new STLExporter();
    const stlString = exporter.parse(meshForExport, {
        binary: false, // Format ASCII untuk kompatibilitas luas
    });
    
    // Buat blob dan download
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Gunakan nama file SVG atau default
    const svgFileInput = document.getElementById('svg-file');
    let fileName = '3d-model.stl';
    if (svgFileInput.files.length > 0) {
        const svgFileName = svgFileInput.files[0].name;
        fileName = svgFileName.replace('.svg', '') + '.stl';
    }
    
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Bersihkan
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

// Handle window resize
function onWindowResize() {
    updateRendererSize();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);