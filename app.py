import os
import json
import mysql.connector
from flask import Flask, render_template, url_for, g, jsonify

app = Flask(__name__)

# --- ADDED BACK: GLOBAL CONFIGURATION ---
IMAGE_DIR_NAME = 'images' 
VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
# ----------------------------------------


# --- MYSQL CONFIGURATION ---
# IMPORTANT: Replace these values with your actual MySQL server details.
# For security, it's best to use environment variables in a real application.
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'  # The user you create for this app
app.config['MYSQL_PASSWORD'] = 'tiger' # The user's password
app.config['MYSQL_DB'] = 'kavya_gallery' # The database you create for this app


# --- DATABASE HELPERS ---

def get_db():
    """Opens a new database connection if there is none for the current context."""
    if 'db' not in g:
        g.db = mysql.connector.connect(
            host=app.config['MYSQL_HOST'],
            user=app.config['MYSQL_USER'],
            password=app.config['MYSQL_PASSWORD'],
            database=app.config['MYSQL_DB']
        )
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    """Closes the database again at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.cli.command('init-db')
def init_db_command():
    """Creates the database tables based on schema.sql."""
    try:
        db = get_db()
        cursor = db.cursor()
        with app.open_resource('schema.sql', mode='r') as f:
            # MySQL connector's execute method doesn't support multiple statements well.
            # We read the whole file and execute it.
            cursor.execute(f.read(), multi=True)
        print("Initialized the database successfully.")
    except mysql.connector.Error as err:
        print(f"Failed to initialize database: {err}")
    finally:
        if 'db' in g:
            g.db.close()


# --- IMAGE & "AI" LOGIC ---

def find_image_files():
    """Scans the 'static/images' directory for image files."""
    image_paths = []
    image_dir_path = os.path.join(app.static_folder, IMAGE_DIR_NAME)
    if not os.path.isdir(image_dir_path):
        return []
    for filename in sorted(os.listdir(image_dir_path)):
        if any(filename.lower().endswith(ext) for ext in VALID_EXTENSIONS):
            path_for_url = f"{IMAGE_DIR_NAME}/{filename}"
            web_path = url_for('static', filename=path_for_url)
            image_paths.append(web_path)
    return image_paths

def sync_images_with_db():
    """Ensures all images in the filesystem are in the database."""
    db = get_db()
    cursor = db.cursor()
    fs_images = set(find_image_files())
    
    cursor.execute('SELECT url FROM images')
    db_images = set(row[0] for row in cursor.fetchall())
    
    new_images = fs_images - db_images
    if new_images:
        print(f"Found {len(new_images)} new images to add to the database.")
        query = "INSERT INTO images (url) VALUES (%s)"
        image_tuples = [(url,) for url in new_images]
        cursor.executemany(query, image_tuples)
        db.commit()
    cursor.close()

def get_all_images_from_db():
    """Fetches all image records from the database."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute('SELECT id, url, views, likes FROM images ORDER BY url')
    images = cursor.fetchall()
    cursor.close()
    return images

def calculate_weighted_sort(image_data):
    if not image_data: return []
    max_views = max((img['views'] for img in image_data), default=1)
    max_likes = max((img['likes'] for img in image_data), default=1)
    max_views = max(max_views, 1)
    max_likes = max(max_likes, 1)
    scored_images = []
    for image in image_data:
        random_factor = os.urandom(4)[0] / 255.0 * 50
        views_factor = (image['views'] / max_views) * 25
        likes_factor = (image['likes'] / max_likes) * 25
        score = random_factor + views_factor + likes_factor
        scored_images.append({'image': image, 'score': score})
    scored_images.sort(key=lambda x: x['score'], reverse=True)
    return [item['image'] for item in scored_images]

# --- FLASK ROUTES ---

@app.route('/')
def gallery():
    """Main gallery route."""
    sync_images_with_db()
    all_images = get_all_images_from_db()
    sorted_images = calculate_weighted_sort(all_images)
    all_image_data_json = json.dumps(sorted_images)
    return render_template('index.html', all_image_data_json=all_image_data_json)

@app.route('/api/like/<int:image_id>', methods=['POST'])
def like_image(image_id):
    """API endpoint to increment the like count for an image."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute('UPDATE images SET likes = likes + 1 WHERE id = %s', (image_id,))
    db.commit()
    cursor.execute('SELECT likes FROM images WHERE id = %s', (image_id,))
    result = cursor.fetchone()
    cursor.close()
    if result:
        return jsonify({'success': True, 'new_likes': result['likes']})
    return jsonify({'success': False, 'message': 'Image not found'}), 404

@app.route('/api/view/<int:image_id>', methods=['POST'])
def view_image(image_id):
    """API endpoint to increment the view count for an image."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute('UPDATE images SET views = views + 1 WHERE id = %s', (image_id,))
    db.commit()
    cursor.execute('SELECT views FROM images WHERE id = %s', (image_id,))
    result = cursor.fetchone()
    cursor.close()
    if result:
        return jsonify({'success': True, 'new_views': result['views']})
    return jsonify({'success': False, 'message': 'Image not found'}), 404

if __name__ == "__main__":
    app.run(debug=True, threaded=True)