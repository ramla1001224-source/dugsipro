import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';
import 'package:go_router/go_router.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _messages = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get(ApiConfig.messages);
      if (mounted) {
        setState(() {
          _messages = res.data is List ? res.data : [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Messages', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_rounded),
            onPressed: () => context.push('/messages/contacts'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _messages.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('ðŸ’¬', style: TextStyle(fontSize: 48.sp)),
                          SizedBox(height: 16.h),
                          const Text('No messages yet', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                          SizedBox(height: 8.h),
                          ElevatedButton(
                            onPressed: () => context.push('/messages/contacts'),
                            child: const Text('Start a Conversation'),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.all(16.w),
                      itemCount: _messages.length,
                      itemBuilder: (ctx, i) {
                        final m = _messages[i];
                        final other = m['senderId'] == m['receiverId'] // Should not happen
                            ? m['sender']
                            : (m['senderId'] == m['currentUserId'] ? m['receiver'] : m['sender']);
                        
                        // Note: currentUserId logic might need backend help or frontend storage check
                        // For simplicity, let's assume sender/receiver logic based on role
                        
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                          child: ListTile(
                            onTap: () => context.push('/messages/chat/${other['id']}', extra: other),
                            leading: CircleAvatar(
                              child: Text(other['name'][0].toUpperCase()),
                            ),
                            title: Text(other['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text(m['content'], maxLines: 1, overflow: TextOverflow.ellipsis),
                            trailing: Text(
                              m['created_at'].toString().split('T').first,
                              style: TextStyle(fontSize: 10.sp, color: Colors.grey),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

