# Kavya's Image Hub (Flask + MySQL Version)

This is a Flask-based web application for displaying an image gallery with persistent likes and views stored in a MySQL database.

## How to Run

### 1. Prerequisite: MySQL Server

You must have a MySQL server running and accessible from where you are running this application.

In your MySQL server, you need to create a database and a dedicated user for this application. Run the following commands in your MySQL client (replacing the password with your own secure password):

```sql
CREATE DATABASE kavya_gallery;
CREATE USER 'kavya_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON kavya_gallery.* TO 'kavya_user'@'localhost';
FLUSH PRIVILEGES;