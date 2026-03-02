# Development Dockerfile for testing custom n8n nodes
FROM n8nio/n8n:1.111.0

USER root

# Install Python and required packages
# - mutagen: for tag_audio.py (audio metadata)
# - python-docx, openpyxl, python-pptx: for tag_office.py (Office document metadata)
# Install exiftool for Tag Media File node
RUN apk add --no-cache python3 py3-pip exiftool && \
    pip3 install --break-system-packages mutagen python-docx openpyxl python-pptx

# Create scripts directory and copy Python scripts
RUN mkdir -p /app && chown node:node /app
COPY --chown=node:node scripts/*.py /app/

USER node
