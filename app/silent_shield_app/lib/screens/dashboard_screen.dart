import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  final _auth = AuthService();
  final _firestore = FirestoreService();
  final _searchController = TextEditingController();
  final _searchNotifier = ValueNotifier<String>('');

  late AnimationController _ringAnimCtrl;
  late Animation<double> _ringAnim;

  @override
  void dispose() {
    _searchController.dispose();
    _searchNotifier.dispose();
    _ringAnimCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _ringAnimCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _ringAnim = CurvedAnimation(
      parent: _ringAnimCtrl,
      curve: Curves.easeOutCubic,
    );
    _ringAnimCtrl.forward();
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161923),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        content: Text(
          'Are you sure you want to sign out?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child:
                Text('Cancel', style: TextStyle(color: Colors.grey[500])),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out',
                style: TextStyle(color: Color(0xFFF5A623))),
          ),
        ],
      ),
    );
    if (confirm == true) await _auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1117),
      appBar: _buildAppBar(),
      body: StreamBuilder<DashboardData>(
        stream: _firestore.dashboardStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFFF5A623)),
            );
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Failed to load data.\n${snapshot.error}',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[500]),
              ),
            );
          }
          final data = snapshot.data ?? DashboardData.empty;
          return _buildBody(data);
        },
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: const Color(0xFF0F1117),
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFF1C1F2E),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.shield_outlined,
                color: Color(0xFFF5A623), size: 18),
          ),
          const SizedBox(width: 10),
          const Text(
            'Safety Dashboard',
            style: TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          onPressed: _logout,
          tooltip: 'Sign Out',
          icon: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFF1C1F2E),
              borderRadius: BorderRadius.circular(9),
              border:
                  Border.all(color: const Color(0xFF2A2D3E), width: 1),
            ),
            child: const Icon(Icons.logout_rounded,
                color: Colors.white70, size: 18),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildBody(DashboardData data) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section label
          Padding(
            padding: const EdgeInsets.only(bottom: 12, left: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Overview',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1F2E),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Last 24 hours',
                    style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 12,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),

          // Safety Score card
          _buildSafetyScoreCard(data),
          const SizedBox(height: 14),

          // 2x2 metric grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            childAspectRatio: 1.45,
            children: [
              _buildMetricCard(
                value: data.toxicDetected.toString(),
                label: 'TOXIC\nDETECTED',
                icon: Icons.warning_amber_rounded,
                iconBg: const Color(0xFF3D1515),
                iconColor: const Color(0xFFFF5C5C),
                valueColor: const Color(0xFFFF5C5C),
              ),
              _buildMetricCard(
                value: data.autoBlurred.toString(),
                label: 'AUTO-\nBLURRED',
                icon: Icons.visibility_outlined,
                iconBg: const Color(0xFF2C2810),
                iconColor: const Color(0xFFF5A623),
                valueColor: const Color(0xFFF5A623),
              ),
              _buildMetricCard(
                value: data.inferences.toString(),
                label: 'INFERENCES',
                icon: Icons.monitor_heart_outlined,
                iconBg: const Color(0xFF0D2D1A),
                iconColor: const Color(0xFF4ADE80),
                valueColor: const Color(0xFF4ADE80),
              ),
              _buildMetricCard(
                value: data.activeDays.toString(),
                label: 'ACTIVE\nDAYS',
                icon: Icons.calendar_today_outlined,
                iconBg: const Color(0xFF1A1E2E),
                iconColor: Colors.grey[400]!,
                valueColor: Colors.white,
              ),
            ],
          ),

          const SizedBox(height: 14),

          // User info card
          _buildUserCard(),

          const SizedBox(height: 20),

          // History Section
          _buildHistorySection(),
        ],
      ),
    );
  }

  Widget _buildSafetyScoreCard(DashboardData data) {
    final score = data.safetyScore;
    final risk = data.riskLevel;

    Color ringColor;
    Color riskColor;
    String riskText;
    String riskSubText;

    switch (risk) {
      case 'high':
        ringColor = const Color(0xFFFF5C5C);
        riskColor = const Color(0xFFFF5C5C);
        riskText = 'High risk';
        riskSubText = 'Immediate action required';
        break;
      case 'elevated':
        ringColor = const Color(0xFFF5A623);
        riskColor = const Color(0xFFF5A623);
        riskText = 'Elevated\nrisk detected';
        riskSubText = 'Based on analysis\nof recent content';
        break;
      default:
        ringColor = const Color(0xFF4ADE80);
        riskColor = const Color(0xFF4ADE80);
        riskText = 'Low risk';
        riskSubText = 'Content looks safe';
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF161923),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF252836), width: 1),
      ),
      child: Row(
        children: [
          // Circular ring
          AnimatedBuilder(
            animation: _ringAnim,
            builder: (_, __) => SizedBox(
              width: 110,
              height: 110,
              child: CustomPaint(
                painter: _RingPainter(
                  progress: (score / 100) * _ringAnim.value,
                  ringColor: ringColor,
                  trackColor: const Color(0xFF252836),
                ),
                child: Center(
                  child: RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: score.toString(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const TextSpan(
                          text: '%',
                          style: TextStyle(
                            color: Colors.white54,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(width: 24),

          // Text info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Safety Score',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: riskColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        riskText,
                        style: TextStyle(
                          color: riskColor,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  riskSubText,
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String value,
    required String label,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161923),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF252836), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon box
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          // Value + label
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserCard() {
    final user = _auth.currentUser;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161923),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF252836), width: 1),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF252836),
            child: Text(
              (user?.email?.isNotEmpty == true)
                  ? user!.email![0].toUpperCase()
                  : '?',
              style: const TextStyle(
                color: Color(0xFFF5A623),
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Signed in as',
                  style: TextStyle(color: Colors.grey, fontSize: 11),
                ),
                const SizedBox(height: 2),
                Text(
                  user?.email ?? 'Unknown',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _logout,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF252836),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Logout',
                style: TextStyle(
                  color: Color(0xFFF5A623),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistorySection() {
    return StreamBuilder<List<HistoryEntry>>(
      stream: _firestore.historyStream(limit: 20),
      builder: (context, snapshot) {
        final allEntries = snapshot.data ?? [];

        return ValueListenableBuilder<String>(
          valueListenable: _searchNotifier,
          builder: (context, searchQuery, child) {
            // Filter entries based on search query
            final entries = searchQuery.isEmpty
                ? allEntries
                : allEntries.where((entry) {
                    final text = entry.text.toLowerCase();
                    final category = entry.category.toLowerCase();
                    final source = entry.source.toLowerCase();
                    return text.contains(searchQuery) ||
                           category.contains(searchQuery) ||
                           source.contains(searchQuery);
                  }).toList();

            return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section header with title and filter buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Activity History',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Search box
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF161923),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF252836), width: 1),
              ),
              child: Row(
                children: [
                  Icon(Icons.search, color: Colors.grey[600], size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (value) {
                        _searchNotifier.value = value.toLowerCase();
                      },
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search history...',
                        hintStyle: TextStyle(color: Colors.grey[600], fontSize: 14),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            
            // Search results count
            if (searchQuery.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 8),
                child: Text(
                  'Found ${entries.length} result${entries.length == 1 ? '' : 's'} for "$searchQuery"',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 12,
                  ),
                ),
              ),

            // History table
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF161923),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF252836), width: 1),
              ),
              child: Column(
                children: [
                  // Table header
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0xFF252836), width: 1),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(flex: 3, child: _buildTableHeader('Content Preview')),
                        Expanded(flex: 2, child: _buildTableHeader('Category')),
                        Expanded(child: _buildTableHeader('Confidence')),
                        Expanded(flex: 2, child: _buildTableHeader('Source')),
                        Expanded(child: _buildTableHeader('Time')),
                        const SizedBox(width: 60, child: Center(
                          child: Text(
                            'Action',
                            style: TextStyle(
                              color: Color(0xFF8B9AAB),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        )),
                      ],
                    ),
                  ),

                  // Table rows
                  if (entries.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      alignment: Alignment.center,
                      child: Text(
                        'No history entries yet',
                        style: TextStyle(color: Colors.grey[500], fontSize: 14),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: entries.length,
                      separatorBuilder: (_, __) => const Divider(
                        color: Color(0xFF252836),
                        height: 1,
                      ),
                      itemBuilder: (context, index) {
                        final entry = entries[index];
                        return _buildHistoryRow(entry);
                      },
                    ),

                  // Pagination footer
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(color: Color(0xFF252836), width: 1),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Showing ${entries.length} entries',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                        Row(
                          children: [
                            IconButton(
                              onPressed: null,
                              icon: Icon(Icons.chevron_left, color: Colors.grey[700], size: 20),
                            ),
                            IconButton(
                              onPressed: null,
                              icon: Icon(Icons.chevron_right, color: Colors.grey[500], size: 20),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
          },
        );
      },
    );
  }

  Widget _buildTableHeader(String text) {
    return Text(
      text,
      style: TextStyle(
        color: Colors.grey[500],
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildHistoryRow(HistoryEntry entry) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Content Preview
          Expanded(
            flex: 3,
            child: Text(
              entry.text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
              ),
            ),
          ),
          // Category
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: entry.categoryColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                entry.category.toUpperCase(),
                style: TextStyle(
                  color: entry.categoryColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          // Confidence
          Expanded(
            child: Text(
              entry.confidence,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
              ),
            ),
          ),
          // Source
          Expanded(
            flex: 2,
            child: Text(
              entry.source,
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 12,
              ),
            ),
          ),
          // Time
          Expanded(
            child: Text(
              entry.relativeTime,
              style: TextStyle(
                color: Colors.grey[500],
                fontSize: 12,
              ),
            ),
          ),
          // Action (Delete button)
          SizedBox(
            width: 60,
            child: Center(
              child: GestureDetector(
                onTap: () async {
                  await _firestore.deleteHistoryEntry(entry.id);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3D1515),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Delete',
                    style: TextStyle(
                      color: Color(0xFFFF5C5C),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom painter for the circular progress ring
class _RingPainter extends CustomPainter {
  final double progress;
  final Color ringColor;
  final Color trackColor;

  _RingPainter({
    required this.progress,
    required this.ringColor,
    required this.trackColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.shortestSide / 2) - 8;
    const strokeWidth = 9.0;

    // Track
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, trackPaint);

    // Progress arc
    final progressPaint = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2, // start at top
      2 * math.pi * progress,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress ||
      old.ringColor != ringColor ||
      old.trackColor != trackColor;
}