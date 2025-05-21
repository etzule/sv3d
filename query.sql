CREATE DATABASE svg3d_converter;
USE svg3d_converter;
CREATE TABLE conversions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255),
  svg_data LONGTEXT,
  settings LONGTEXT,
  date DATETIME
);