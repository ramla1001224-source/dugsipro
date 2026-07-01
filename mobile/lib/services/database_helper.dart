import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  factory DatabaseHelper() => _instance;
  DatabaseHelper._internal();

  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final directory = await getApplicationDocumentsDirectory();
    final path = join(directory.path, 'smart_school_pro_offline.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE ApiCache (
        url TEXT PRIMARY KEY,
        data TEXT,
        timestamp INTEGER
      )
    ''');

    await db.execute('''
      CREATE TABLE SyncQueue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT,
        url TEXT,
        data TEXT,
        timestamp INTEGER
      )
    ''');
  }

  // --- Cache Methods (GET requests) ---

  Future<void> saveCache(String url, dynamic data) async {
    final db = await database;
    await db.insert(
      'ApiCache',
      {
        'url': url,
        'data': jsonEncode(data),
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<dynamic> getCache(String url) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'ApiCache',
      where: 'url = ?',
      whereArgs: [url],
    );

    if (maps.isNotEmpty) {
      return jsonDecode(maps.first['data'] as String);
    }
    return null;
  }

  Future<void> clearCache() async {
    final db = await database;
    await db.delete('ApiCache');
  }

  // --- Sync Queue Methods (POST/PUT/DELETE requests) ---

  Future<void> enqueueSync(String method, String url, dynamic data) async {
    final db = await database;
    await db.insert(
      'SyncQueue',
      {
        'method': method,
        'url': url,
        'data': jsonEncode(data),
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      },
    );
  }

  Future<List<Map<String, dynamic>>> getSyncQueue() async {
    final db = await database;
    return await db.query('SyncQueue', orderBy: 'timestamp ASC');
  }

  Future<void> removeFromQueue(int id) async {
    final db = await database;
    await db.delete('SyncQueue', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> clearQueue() async {
    final db = await database;
    await db.delete('SyncQueue');
  }
}
