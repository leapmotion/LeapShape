import os
from datetime import date
import re

header = '''/**
 * Copyright ''' + str(date.today().year) + ''' Ultraleap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'''

for root, dirs, files in os.walk("./src"):
    for file in files:
        if file.lower().endswith(".js"):
            filepath = os.path.join(root, file)

            # Read File Text
            src_file = open(filepath, "r")
            text = src_file.read()
            src_file.close()

            # Add or Update the Copywrite Header
            if not text.startswith("/**"):
                print("Added Header to " + filepath)
                text = header + text
            else:
                # Brittle Updating Mechanism
                pattern = re.compile(r'(\/\*)(?:.|\n)*(\*\/\n\n)', re.MULTILINE)
                text = re.sub(pattern, header, text)

            # Write File Text
            src_file = open(filepath, "w")
            src_file.write(text)
            src_file.close()
