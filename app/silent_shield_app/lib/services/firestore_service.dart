import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class DashboardData {
  final int safetyScore;
  final int toxicDetected;
  final int autoBlurred;
  final int inferences;
  final int activeDays;
  final String riskLevel; // 'low' | 'elevated' | 'high'

  const DashboardData({
    required this.safetyScore,
    required this.toxicDetected,
    required this.autoBlurred,
    required this.inferences,
    required this.activeDays,
    required this.riskLevel,
  });

  factory DashboardData.fromMap(Map<String, dynamic> map) {
    return DashboardData(
      safetyScore: (map['safetyScore'] as num?)?.toInt() ?? 0,
      toxicDetected: (map['toxicDetected'] as num?)?.toInt() ?? 0,
      autoBlurred: (map['autoBlurred'] as num?)?.toInt() ?? 0,
      inferences: (map['inferences'] as num?)?.toInt() ?? 0,
      activeDays: (map['activeDays'] as num?)?.toInt() ?? 0,
      riskLevel: (map['riskLevel'] as String?) ?? 'low',
    );
  }

  /// Fallback data when Firestore doc doesn't exist yet
  static const DashboardData empty = DashboardData(
    safetyScore: 0,
    toxicDetected: 0,
    autoBlurred: 0,
    inferences: 0,
    activeDays: 0,
    riskLevel: 'low',
  );
}

/// Individual history entry for detected content
class HistoryEntry {
  final String id;
  final String text;
  final String category;
  final String confidence;
  final double score;
  final String source;
  final DateTime? timestamp;
  final String action;

  const HistoryEntry({
    required this.id,
    required this.text,
    required this.category,
    required this.confidence,
    required this.score,
    required this.source,
    this.timestamp,
    required this.action,
  });

  factory HistoryEntry.fromMap(String id, Map<String, dynamic> map) {
    return HistoryEntry(
      id: id,
      text: map['text'] as String? ?? '',
      category: map['category'] as String? ?? 'toxic',
      confidence: map['confidence'] as String? ?? '0%',
      score: (map['score'] as num?)?.toDouble() ?? 0.0,
      source: map['source'] as String? ?? 'Unknown',
      timestamp: (map['timestamp'] as Timestamp?)?.toDate(),
      action: map['action'] as String? ?? 'Detected',
    );
  }

  String get relativeTime {
    if (timestamp == null) return 'Unknown';
    final now = DateTime.now();
    final diff = now.difference(timestamp!);

    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hour ago';
    if (diff.inDays == 1) return '1 day ago';
    return '${diff.inDays} days ago';
  }

  Color get categoryColor {
    switch (category.toLowerCase()) {
      case 'hate':
      case 'hate speech':
        return const Color(0xFFFF5C5C);
      case 'toxic':
        return const Color(0xFFF5A623);
      case 'harassment':
        return const Color(0xFFE05C6E);
      case 'profanity':
        return const Color(0xFF8B9AAB);
      case 'safe':
        return const Color(0xFF4ADE80);
      default:
        return const Color(0xFFF5A623);
    }
  }
}

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String get _uid => _auth.currentUser!.uid;

  /// Real-time stream of the current user's dashboard document.
  /// Document path: users/{uid}/dashboard/summary
  Stream<DashboardData> dashboardStream() {
    return _db
        .collection('users')
        .doc(_uid)
        .collection('dashboard')
        .doc('summary')
        .snapshots()
        .map((snap) {
      if (!snap.exists || snap.data() == null) return DashboardData.empty;
      return DashboardData.fromMap(snap.data()!);
    });
  }

  /// Real-time stream of history entries from detections collection
  Stream<List<HistoryEntry>> historyStream({int limit = 50}) {
    return _db
        .collection('users')
        .doc(_uid)
        .collection('detections')
        .orderBy('timestamp', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        // Parse timestamp (stored as int milliseconds or Timestamp)
        DateTime? timestamp;
        final ts = data['timestamp'];
        if (ts is Timestamp) {
          timestamp = ts.toDate();
        } else if (ts is int) {
          timestamp = DateTime.fromMillisecondsSinceEpoch(ts);
        } else if (ts is String) {
          timestamp = DateTime.tryParse(ts);
        }
        
        // Parse score (can be int or double)
        final scoreVal = data['score'];
        double score = 0.0;
        if (scoreVal is num) {
          score = scoreVal.toDouble();
        }
        
        return HistoryEntry(
          id: doc.id,
          text: data['text'] as String? ?? '',
          category: data['category'] as String? ?? 'toxic',
          confidence: data['confidence'] as String? ?? '0%',
          score: score,
          source: data['source'] as String? ?? 'Unknown',
          timestamp: timestamp,
          action: data['action'] as String? ?? 'Detected',
        );
      }).toList();
    });
  }

  /// Delete a specific detection entry
  Future<void> deleteHistoryEntry(String entryId) async {
    await _db
        .collection('users')
        .doc(_uid)
        .collection('detections')
        .doc(entryId)
        .delete();
  }

  /// Seed initial data for a new user (call after sign-up if desired)
  Future<void> initUserDashboard() async {
    final ref = _db
        .collection('users')
        .doc(_uid)
        .collection('dashboard')
        .doc('summary');

    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'safetyScore': 60,
        'toxicDetected': 67,
        'autoBlurred': 67,
        'inferences': 168,
        'activeDays': 1,
        'riskLevel': 'elevated',
        'createdAt': FieldValue.serverTimestamp(),
      });
    }
  }
}