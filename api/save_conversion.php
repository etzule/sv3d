<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli('localhost', 'root', '', 'svg3d_converter');

if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => 'Koneksi database gagal']));
}

$data = json_decode(file_get_contents('php://input'), true);

$stmt = $conn->prepare('INSERT INTO conversions (file_name, svg_data, settings, date) VALUES (?, ?, ?, ?)');
$stmt->bind_param('ssss', $data['fileName'], $data['svgData'], $data['settings'], $data['date']);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}

$stmt->close();
$conn->close();
?>