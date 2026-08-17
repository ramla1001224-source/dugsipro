import os
import re

routes_dir = r"backend\src\routes"

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Replace studentRegId pattern
    pattern_reg_id = r"const relatedStudents = await prisma\.student\.findMany\(\{\s*where: \{\s*OR: \[\s*\{\s*userId: student\.userId\s*\},.*?\{ student_id: \{ equals: studentRegId, mode: 'insensitive' \} \},.*?\]\s*\}\s*\]\s*\},.*?select: \{ id: true, student_id: true \}\s*\}\);"

    # This is getting complicated. I will just replace `OR: [` with a dynamic OR builder.

