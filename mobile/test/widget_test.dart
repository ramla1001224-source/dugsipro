import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smart_school_pro/main.dart';

void main() {
  testWidgets('App starts without crashing', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const DugsiProApp());
    await tester.pumpAndSettle();

    // Verify it boots into a MaterialApp
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
