#!/usr/bin/env python3
"""
Tag audio files with metadata.
Supports WAV (RIFF INFO + ID3v2.3), MP3 (ID3v2.3), FLAC (Vorbis), M4A (MP4 atoms).

Usage: tag_audio.py <audio_path> <meta_path>
"""

import sys
import struct
from pathlib import Path

# Import shared utilities
sys.path.insert(0, '/app')
from meta_utils import load_metadata, get_value, get_extended, error_exit

# Mp3tag field name to ID3v2.3 frame mapping
MP3TAG_TO_ID3 = {
    'ACOUSTID_FINGERPRINT': 'TXXX:Acoustid Fingerprint',
    'ACOUSTID_ID': 'TXXX:Acoustid Id',
    'ALBUMARTISTSORT': 'TSO2',
    'ALBUMSORT': 'TSOA',
    'ARRANGER': 'TXXX:ARRANGER',
    'ARTISTSORT': 'TSOP',
    'ASIN': 'TXXX:ASIN',
    'BARCODE': 'TXXX:BARCODE',
    'CATALOGNUMBER': 'TXXX:CATALOGNUMBER',
    'COMPILATION': 'TCMP',
    'COMPOSERSORT': 'TSOC',
    'CONDUCTOR': 'TPE3',
    'CONTENTGROUP': 'TIT1',
    'DISCSUBTITLE': 'TSST',
    'DJMIXER': 'TXXX:DJMIXER',
    'ENCODEDBY': 'TENC',
    'ENCODER': 'TSSE',
    'ENCODERSETTINGS': 'TSSE',
    'ENGINEER': 'TXXX:ENGINEER',
    'INITIALKEY': 'TKEY',
    'INVOLVEDPEOPLE': 'TIPL',
    'ISRC': 'TSRC',
    'LABEL': 'TPUB',
    'LANGUAGE': 'TLAN',
    'LYRICIST': 'TEXT',
    'MEDIATYPE': 'TMED',
    'MIXER': 'TXXX:MIXER',
    'MOOD': 'TXXX:MOOD',
    'MOVEMENT': 'MVNM',
    'MOVEMENTNUMBER': 'MVIN',
    'MOVEMENTTOTAL': 'MVIN',
    'MUSICBRAINZ_ALBUMARTISTID': 'TXXX:MusicBrainz Album Artist Id',
    'MUSICBRAINZ_ALBUMID': 'TXXX:MusicBrainz Album Id',
    'MUSICBRAINZ_ARTISTID': 'TXXX:MusicBrainz Artist Id',
    'MUSICBRAINZ_RELEASEGROUPID': 'TXXX:MusicBrainz Release Group Id',
    'MUSICBRAINZ_TRACKID': 'UFID:http://musicbrainz.org',
    'MUSICIANCREDITS': 'TMCL',
    'ORIGINALALBUM': 'TOAL',
    'ORIGINALARTIST': 'TOPE',
    'ORIGINALYEAR': 'TORY',
    'PRODUCER': 'TXXX:PRODUCER',
    'RATING': 'POPM',
    'RELEASETYPE': 'TXXX:MusicBrainz Album Type',
    'REMIXEDBY': 'TPE4',
    'REPLAYGAIN_ALBUM_GAIN': 'TXXX:replaygain_album_gain',
    'REPLAYGAIN_ALBUM_PEAK': 'TXXX:replaygain_album_peak',
    'REPLAYGAIN_TRACK_GAIN': 'TXXX:replaygain_track_gain',
    'REPLAYGAIN_TRACK_PEAK': 'TXXX:replaygain_track_peak',
    'SCRIPT': 'TXXX:SCRIPT',
    'SHOWMOVEMENT': 'TXXX:SHOWMOVEMENT',
    'SUBTITLE': 'TIT3',
    'TITLESORT': 'TSOT',
    'UNSYNCEDLYRICS': 'USLT',
    'WORK': 'TIT1',
    'WWW': 'WXXX',
    'WWWARTIST': 'WOAR',
    'WWWCOMMERCIALINFO': 'WCOM',
    'WWWCOPYRIGHT': 'WCOP',
    'WWWPAYMENT': 'WPAY',
    'WWWPUBLISHER': 'WPUB',
    'WWWRADIO': 'WORS',
}

# Mp3tag field name to Vorbis comment mapping
MP3TAG_TO_VORBIS = {
    'ACOUSTID_FINGERPRINT': 'ACOUSTID_FINGERPRINT',
    'ACOUSTID_ID': 'ACOUSTID_ID',
    'ALBUMARTISTSORT': 'ALBUMARTISTSORT',
    'ALBUMSORT': 'ALBUMSORT',
    'ARRANGER': 'ARRANGER',
    'ARTISTSORT': 'ARTISTSORT',
    'ASIN': 'ASIN',
    'BARCODE': 'BARCODE',
    'CATALOGNUMBER': 'CATALOGNUMBER',
    'COMPILATION': 'COMPILATION',
    'COMPOSERSORT': 'COMPOSERSORT',
    'CONDUCTOR': 'CONDUCTOR',
    'CONTENTGROUP': 'GROUPING',
    'DISCSUBTITLE': 'DISCSUBTITLE',
    'DJMIXER': 'DJMIXER',
    'ENCODEDBY': 'ENCODEDBY',
    'ENCODER': 'ENCODER',
    'ENCODERSETTINGS': 'ENCODERSETTINGS',
    'ENGINEER': 'ENGINEER',
    'INITIALKEY': 'KEY',
    'INVOLVEDPEOPLE': 'INVOLVEDPEOPLE',
    'ISRC': 'ISRC',
    'LABEL': 'LABEL',
    'LANGUAGE': 'LANGUAGE',
    'LYRICIST': 'LYRICIST',
    'MEDIATYPE': 'MEDIA',
    'MIXER': 'MIXER',
    'MOOD': 'MOOD',
    'MOVEMENT': 'MOVEMENT',
    'MOVEMENTNUMBER': 'MOVEMENTNUMBER',
    'MOVEMENTTOTAL': 'MOVEMENTTOTAL',
    'MUSICBRAINZ_ALBUMARTISTID': 'MUSICBRAINZ_ALBUMARTISTID',
    'MUSICBRAINZ_ALBUMID': 'MUSICBRAINZ_ALBUMID',
    'MUSICBRAINZ_ARTISTID': 'MUSICBRAINZ_ARTISTID',
    'MUSICBRAINZ_RELEASEGROUPID': 'MUSICBRAINZ_RELEASEGROUPID',
    'MUSICBRAINZ_TRACKID': 'MUSICBRAINZ_TRACKID',
    'MUSICIANCREDITS': 'PERFORMER',
    'ORIGINALALBUM': 'ORIGINALALBUM',
    'ORIGINALARTIST': 'ORIGINALARTIST',
    'ORIGINALYEAR': 'ORIGINALYEAR',
    'PRODUCER': 'PRODUCER',
    'RATING': 'RATING',
    'RELEASETYPE': 'RELEASETYPE',
    'REMIXEDBY': 'REMIXEDBY',
    'REPLAYGAIN_ALBUM_GAIN': 'REPLAYGAIN_ALBUM_GAIN',
    'REPLAYGAIN_ALBUM_PEAK': 'REPLAYGAIN_ALBUM_PEAK',
    'REPLAYGAIN_TRACK_GAIN': 'REPLAYGAIN_TRACK_GAIN',
    'REPLAYGAIN_TRACK_PEAK': 'REPLAYGAIN_TRACK_PEAK',
    'SCRIPT': 'SCRIPT',
    'SHOWMOVEMENT': 'SHOWMOVEMENT',
    'SUBTITLE': 'SUBTITLE',
    'TITLESORT': 'TITLESORT',
    'UNSYNCEDLYRICS': 'LYRICS',
    'WORK': 'WORK',
    'WWW': 'WWW',
    'WWWARTIST': 'WWWARTIST',
    'WWWCOMMERCIALINFO': 'WWWCOMMERCIALINFO',
    'WWWCOPYRIGHT': 'WWWCOPYRIGHT',
    'WWWPAYMENT': 'WWWPAYMENT',
    'WWWPUBLISHER': 'WWWPUBLISHER',
    'WWWRADIO': 'WWWRADIO',
}

# Mp3tag field name to MP4 atom mapping
MP3TAG_TO_MP4 = {
    'ACOUSTID_FINGERPRINT': '----:com.apple.iTunes:Acoustid Fingerprint',
    'ACOUSTID_ID': '----:com.apple.iTunes:Acoustid Id',
    'ALBUMARTISTSORT': 'soaa',
    'ALBUMSORT': 'soal',
    'ARRANGER': '----:com.apple.iTunes:ARRANGER',
    'ARTISTSORT': 'soar',
    'ASIN': '----:com.apple.iTunes:ASIN',
    'BARCODE': '----:com.apple.iTunes:BARCODE',
    'CATALOGNUMBER': '----:com.apple.iTunes:CATALOGNUMBER',
    'COMPILATION': 'cpil',
    'COMPOSERSORT': 'soco',
    'CONDUCTOR': '----:com.apple.iTunes:CONDUCTOR',
    'CONTENTGROUP': '\xa9grp',
    'DISCSUBTITLE': '----:com.apple.iTunes:DISCSUBTITLE',
    'DJMIXER': '----:com.apple.iTunes:DJMIXER',
    'ENCODEDBY': '\xa9too',
    'ENCODER': '\xa9too',
    'ENCODERSETTINGS': '----:com.apple.iTunes:ENCODERSETTINGS',
    'ENGINEER': '----:com.apple.iTunes:ENGINEER',
    'INITIALKEY': '----:com.apple.iTunes:initialkey',
    'INVOLVEDPEOPLE': '----:com.apple.iTunes:INVOLVEDPEOPLE',
    'ISRC': '----:com.apple.iTunes:ISRC',
    'LABEL': '----:com.apple.iTunes:LABEL',
    'LANGUAGE': '----:com.apple.iTunes:LANGUAGE',
    'LYRICIST': '----:com.apple.iTunes:LYRICIST',
    'MEDIATYPE': '----:com.apple.iTunes:MEDIA',
    'MIXER': '----:com.apple.iTunes:MIXER',
    'MOOD': '----:com.apple.iTunes:MOOD',
    'MOVEMENT': '\xa9mvn',
    'MOVEMENTNUMBER': '\xa9mvi',
    'MOVEMENTTOTAL': '\xa9mvc',
    'MUSICBRAINZ_ALBUMARTISTID': '----:com.apple.iTunes:MusicBrainz Album Artist Id',
    'MUSICBRAINZ_ALBUMID': '----:com.apple.iTunes:MusicBrainz Album Id',
    'MUSICBRAINZ_ARTISTID': '----:com.apple.iTunes:MusicBrainz Artist Id',
    'MUSICBRAINZ_RELEASEGROUPID': '----:com.apple.iTunes:MusicBrainz Release Group Id',
    'MUSICBRAINZ_TRACKID': '----:com.apple.iTunes:MusicBrainz Track Id',
    'MUSICIANCREDITS': '----:com.apple.iTunes:MUSICIANCREDITS',
    'ORIGINALALBUM': '----:com.apple.iTunes:ORIGINALALBUM',
    'ORIGINALARTIST': '----:com.apple.iTunes:ORIGINALARTIST',
    'ORIGINALYEAR': '----:com.apple.iTunes:ORIGINALYEAR',
    'PRODUCER': '----:com.apple.iTunes:PRODUCER',
    'RATING': 'rtng',
    'RELEASETYPE': '----:com.apple.iTunes:MusicBrainz Album Type',
    'REMIXEDBY': '----:com.apple.iTunes:REMIXEDBY',
    'REPLAYGAIN_ALBUM_GAIN': '----:com.apple.iTunes:replaygain_album_gain',
    'REPLAYGAIN_ALBUM_PEAK': '----:com.apple.iTunes:replaygain_album_peak',
    'REPLAYGAIN_TRACK_GAIN': '----:com.apple.iTunes:replaygain_track_gain',
    'REPLAYGAIN_TRACK_PEAK': '----:com.apple.iTunes:replaygain_track_peak',
    'SCRIPT': '----:com.apple.iTunes:SCRIPT',
    'SHOWMOVEMENT': 'shwm',
    'SUBTITLE': '----:com.apple.iTunes:SUBTITLE',
    'TITLESORT': 'sonm',
    'UNSYNCEDLYRICS': '\xa9lyr',
    'WORK': '\xa9wrk',
    'WWW': '----:com.apple.iTunes:WWW',
    'WWWARTIST': '----:com.apple.iTunes:WWWARTIST',
    'WWWCOMMERCIALINFO': '----:com.apple.iTunes:WWWCOMMERCIALINFO',
    'WWWCOPYRIGHT': '----:com.apple.iTunes:WWWCOPYRIGHT',
    'WWWPAYMENT': '----:com.apple.iTunes:WWWPAYMENT',
    'WWWPUBLISHER': '----:com.apple.iTunes:WWWPUBLISHER',
    'WWWRADIO': '----:com.apple.iTunes:WWWRADIO',
}

# RIFF INFO chunk IDs for standard fields
RIFF_INFO_MAP = {
    'title': 'INAM',
    'artist': 'IART',
    'album': 'IPRD',
    'genre': 'IGNR',
    'year': 'ICRD',
    'trackNumber': 'ITRK',
    'copyright': 'ICOP',
    'comment': 'ICMT',
}


def write_riff_info(audio_path: str, meta: dict) -> None:
    """Write RIFF INFO chunks to a WAV file.

    Reads the entire file, strips existing LIST chunks, adds new INFO,
    and rebuilds the complete RIFF structure.
    """
    with open(audio_path, 'rb') as f:
        data = f.read()

    # Validate WAV header
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        return  # Not a valid WAV file

    # Build INFO chunk content
    info_data = b''
    for field, chunk_id in RIFF_INFO_MAP.items():
        value = get_value(meta, field)
        if value is None:
            continue
        encoded = str(value).encode('latin-1', errors='replace') + b'\x00'
        if len(encoded) % 2 != 0:
            encoded += b'\x00'  # Word alignment
        info_data += chunk_id.encode('ascii') + struct.pack('<I', len(encoded)) + encoded

    if not info_data:
        return  # Nothing to write

    list_chunk = b'LIST' + struct.pack('<I', 4 + len(info_data)) + b'INFO' + info_data

    # Parse existing RIFF body, strip any existing LIST chunks
    body = data[12:]  # Skip "RIFF" + size + "WAVE"
    new_body = b''
    i = 0
    while i + 8 <= len(body):
        chunk_id = body[i:i+4]
        chunk_size = struct.unpack('<I', body[i+4:i+8])[0]
        padded_size = chunk_size + (chunk_size % 2)  # RIFF chunks are word-aligned
        if chunk_id == b'LIST':
            # Skip existing LIST chunks
            i += 8 + padded_size
            continue
        new_body += body[i:i+8+padded_size]
        i += 8 + padded_size

    # Add our new LIST INFO chunk
    new_body += list_chunk

    # Rebuild complete RIFF structure
    new_riff = b'RIFF' + struct.pack('<I', 4 + len(new_body)) + b'WAVE' + new_body

    with open(audio_path, 'wb') as f:
        f.write(new_riff)


def id3_tag_exists(audio, field: str) -> bool:
    """Check if an ID3 tag exists for the given field."""
    field_upper = field.upper()

    if field_upper not in MP3TAG_TO_ID3:
        # Check for TXXX with this description
        for frame in audio.getall('TXXX'):
            if frame.desc == field:
                return True
        return False

    frame_id = MP3TAG_TO_ID3[field_upper]

    if frame_id.startswith('TXXX:'):
        desc = frame_id[5:]
        for frame in audio.getall('TXXX'):
            if frame.desc == desc:
                return True
        return False

    return frame_id in audio


def write_id3_extended(audio, field: str, prop) -> None:
    """Write an extended property to ID3 tags.

    Args:
        audio: The ID3 tag object
        field: The field name
        prop: ExtendedProperty with value and mode, or string for backwards compat
    """
    from mutagen.id3 import (TXXX, TSRC, TSOA, TSOP, TSO2, TSOT, TSOC, TKEY, TLAN, TMED,
                             WXXX, WOAR, WCOM, WCOP, WPAY, WPUB, WORS, USLT, TPE3, TPE4,
                             TIT1, TIT3, TSST, TENC, TSSE, TEXT, TIPL, TMCL, TOAL, TOPE,
                             TORY, MVNM, MVIN, POPM)

    # Handle both ExtendedProperty and string (backwards compat)
    if hasattr(prop, 'value'):
        value = prop.value
        mode = prop.mode
    else:
        value = str(prop)
        mode = 'overwrite'

    # Check if we should skip due to preserve mode
    if mode == 'preserve' and id3_tag_exists(audio, field):
        return

    field_upper = field.upper()
    if field_upper not in MP3TAG_TO_ID3:
        # Unknown field - write as TXXX
        audio.add(TXXX(encoding=1, desc=field, text=[value]))
        return

    frame_id = MP3TAG_TO_ID3[field_upper]

    # Handle TXXX frames
    if frame_id.startswith('TXXX:'):
        desc = frame_id[5:]
        audio.add(TXXX(encoding=1, desc=desc, text=[value]))
    # Handle URL frames
    elif frame_id == 'WXXX':
        audio.add(WXXX(encoding=1, desc='', url=value))
    elif frame_id == 'WOAR':
        audio.add(WOAR(url=value))
    elif frame_id == 'WCOM':
        from mutagen.id3 import WCOM
        audio.add(WCOM(url=value))
    elif frame_id == 'WCOP':
        from mutagen.id3 import WCOP
        audio.add(WCOP(url=value))
    elif frame_id == 'WPAY':
        from mutagen.id3 import WPAY
        audio.add(WPAY(url=value))
    elif frame_id == 'WPUB':
        from mutagen.id3 import WPUB
        audio.add(WPUB(url=value))
    elif frame_id == 'WORS':
        from mutagen.id3 import WORS
        audio.add(WORS(url=value))
    # Handle lyrics
    elif frame_id == 'USLT':
        audio['USLT'] = USLT(encoding=1, lang='eng', desc='', text=value)
    # Handle rating (POPM)
    elif frame_id == 'POPM':
        try:
            rating = int(value)
            audio.add(POPM(email='', rating=rating, count=0))
        except ValueError:
            pass
    # Handle all other text frames generically
    else:
        # Import the frame class dynamically
        try:
            from mutagen import id3
            frame_class = getattr(id3, frame_id, None)
            if frame_class:
                audio[frame_id] = frame_class(encoding=1, text=[value])
            else:
                # Fallback to TXXX
                audio.add(TXXX(encoding=1, desc=field, text=[value]))
        except Exception:
            audio.add(TXXX(encoding=1, desc=field, text=[value]))


def tag_wav(audio_path: str, meta: dict, extended: dict) -> None:
    """Tag a WAV file with both RIFF INFO and ID3v2.3 tags.

    Writes RIFF INFO for Windows Explorer compatibility and ID3v2.3 for modern players.
    """
    from mutagen.wave import WAVE
    from mutagen.id3 import TIT2, TPE1, TPE2, TALB, TYER, TCON, TRCK, TPOS
    from mutagen.id3 import TCOM, TBPM, TCOP, TPUB, COMM, USLT

    # First write RIFF INFO chunks (must be done before ID3)
    write_riff_info(audio_path, meta)

    # Then write ID3v2.3 tags
    audio = WAVE(audio_path)

    if audio.tags is None:
        audio.add_tags()

    tags = audio.tags
    enc = 1  # UTF-16 — required for ID3v2.3 Windows compatibility

    # Standard fields - use tags.add() for proper handling
    if get_value(meta, 'title'):
        tags.add(TIT2(encoding=enc, text=str(meta['title'])))
    if get_value(meta, 'artist'):
        tags.add(TPE1(encoding=enc, text=str(meta['artist'])))
    if get_value(meta, 'albumArtist'):
        tags.add(TPE2(encoding=enc, text=str(meta['albumArtist'])))
    if get_value(meta, 'album'):
        tags.add(TALB(encoding=enc, text=str(meta['album'])))
    if get_value(meta, 'year'):
        tags.add(TYER(encoding=enc, text=str(meta['year'])))
    if get_value(meta, 'genre'):
        tags.add(TCON(encoding=enc, text=str(meta['genre'])))
    if get_value(meta, 'trackNumber'):
        tags.add(TRCK(encoding=enc, text=str(meta['trackNumber'])))
    if get_value(meta, 'discNumber'):
        tags.add(TPOS(encoding=enc, text=str(meta['discNumber'])))
    if get_value(meta, 'composer'):
        tags.add(TCOM(encoding=enc, text=str(meta['composer'])))
    if get_value(meta, 'bpm'):
        tags.add(TBPM(encoding=enc, text=str(meta['bpm'])))
    if get_value(meta, 'copyright'):
        tags.add(TCOP(encoding=enc, text=str(meta['copyright'])))
    if get_value(meta, 'publisher'):
        tags.add(TPUB(encoding=enc, text=str(meta['publisher'])))

    # Comment - always write to clear any existing comment
    tags.add(COMM(encoding=enc, lang='eng', desc='', text=str(meta.get('comment', ''))))

    # Lyrics
    if get_value(meta, 'lyrics'):
        tags.add(USLT(encoding=enc, lang='eng', desc='', text=str(meta['lyrics'])))

    # Extended properties
    for field, prop in extended.items():
        write_id3_extended(tags, field, prop)

    audio.save(v2_version=3)


def tag_mp3(audio_path: str, meta: dict, extended: dict) -> None:
    """Tag an MP3 file with ID3v2.3."""
    from mutagen.id3 import ID3, TIT2, TPE1, TPE2, TALB, TYER, TCON, TRCK, TPOS
    from mutagen.id3 import TCOM, TBPM, TCOP, TPUB, COMM, USLT, ID3NoHeaderError

    try:
        audio = ID3(audio_path)
    except ID3NoHeaderError:
        audio = ID3()

    # Standard fields (same as WAV ID3 section)
    if get_value(meta, 'title'):
        audio['TIT2'] = TIT2(encoding=1, text=[meta['title']])
    if get_value(meta, 'artist'):
        audio['TPE1'] = TPE1(encoding=1, text=[meta['artist']])
    if get_value(meta, 'albumArtist'):
        audio['TPE2'] = TPE2(encoding=1, text=[meta['albumArtist']])
    if get_value(meta, 'album'):
        audio['TALB'] = TALB(encoding=1, text=[meta['album']])
    if get_value(meta, 'year'):
        audio['TYER'] = TYER(encoding=1, text=[meta['year']])
    if get_value(meta, 'genre'):
        audio['TCON'] = TCON(encoding=1, text=[meta['genre']])
    if get_value(meta, 'trackNumber'):
        audio['TRCK'] = TRCK(encoding=1, text=[meta['trackNumber']])
    if get_value(meta, 'discNumber'):
        audio['TPOS'] = TPOS(encoding=1, text=[meta['discNumber']])
    if get_value(meta, 'composer'):
        audio['TCOM'] = TCOM(encoding=1, text=[meta['composer']])
    if get_value(meta, 'bpm'):
        audio['TBPM'] = TBPM(encoding=1, text=[meta['bpm']])
    if get_value(meta, 'copyright'):
        audio['TCOP'] = TCOP(encoding=1, text=[meta['copyright']])
    if get_value(meta, 'publisher'):
        audio['TPUB'] = TPUB(encoding=1, text=[meta['publisher']])

    # Comment
    comment_value = get_value(meta, 'comment')
    if comment_value is not None:
        audio['COMM'] = COMM(encoding=1, lang='eng', desc='', text=[comment_value])
    elif 'comment' in meta and meta['comment'] == '':
        audio.delall('COMM')

    # Lyrics
    if get_value(meta, 'lyrics'):
        audio['USLT'] = USLT(encoding=1, lang='eng', desc='', text=meta['lyrics'])

    # Extended properties
    for field, prop in extended.items():
        write_id3_extended(audio, field, prop)

    audio.save(audio_path, v2_version=3)


def tag_flac(audio_path: str, meta: dict, extended: dict) -> None:
    """Tag a FLAC file with Vorbis comments."""
    from mutagen.flac import FLAC

    audio = FLAC(audio_path)

    # Standard fields
    if get_value(meta, 'title'):
        audio['TITLE'] = meta['title']
    if get_value(meta, 'artist'):
        audio['ARTIST'] = meta['artist']
    if get_value(meta, 'albumArtist'):
        audio['ALBUMARTIST'] = meta['albumArtist']
    if get_value(meta, 'album'):
        audio['ALBUM'] = meta['album']
    if get_value(meta, 'year'):
        audio['DATE'] = meta['year']
    if get_value(meta, 'genre'):
        audio['GENRE'] = meta['genre']
    if get_value(meta, 'trackNumber'):
        audio['TRACKNUMBER'] = meta['trackNumber']
    if get_value(meta, 'discNumber'):
        audio['DISCNUMBER'] = meta['discNumber']
    if get_value(meta, 'composer'):
        audio['COMPOSER'] = meta['composer']
    if get_value(meta, 'bpm'):
        audio['BPM'] = meta['bpm']
    if get_value(meta, 'copyright'):
        audio['COPYRIGHT'] = meta['copyright']
    if get_value(meta, 'publisher'):
        audio['ORGANIZATION'] = meta['publisher']

    # Comment
    comment_value = get_value(meta, 'comment')
    if comment_value is not None:
        audio['COMMENT'] = comment_value
    elif 'comment' in meta and meta['comment'] == '':
        if 'COMMENT' in audio:
            del audio['COMMENT']

    # Lyrics
    if get_value(meta, 'lyrics'):
        audio['LYRICS'] = meta['lyrics']

    # Extended properties
    for field, prop in extended.items():
        # Handle both ExtendedProperty and string (backwards compat)
        if hasattr(prop, 'value'):
            value = prop.value
            mode = prop.mode
        else:
            value = str(prop)
            mode = 'overwrite'

        field_upper = field.upper()
        if field_upper in MP3TAG_TO_VORBIS:
            vorbis_key = MP3TAG_TO_VORBIS[field_upper]
            # Check preserve mode
            if mode == 'preserve' and vorbis_key in audio:
                continue
            audio[vorbis_key] = value
        else:
            # Use field name directly for unknown fields
            if mode == 'preserve' and field_upper in audio:
                continue
            audio[field_upper] = value

    audio.save()


def tag_m4a(audio_path: str, meta: dict, extended: dict) -> None:
    """Tag an M4A/MP4 file with iTunes-style atoms."""
    from mutagen.mp4 import MP4, MP4FreeForm

    audio = MP4(audio_path)

    # Standard fields
    if get_value(meta, 'title'):
        audio['\xa9nam'] = [meta['title']]
    if get_value(meta, 'artist'):
        audio['\xa9ART'] = [meta['artist']]
    if get_value(meta, 'albumArtist'):
        audio['aART'] = [meta['albumArtist']]
    if get_value(meta, 'album'):
        audio['\xa9alb'] = [meta['album']]
    if get_value(meta, 'year'):
        audio['\xa9day'] = [meta['year']]
    if get_value(meta, 'genre'):
        audio['\xa9gen'] = [meta['genre']]
    if get_value(meta, 'trackNumber'):
        # Parse track number (e.g., "1" or "1/12")
        track_str = str(meta['trackNumber'])
        if '/' in track_str:
            track_num, track_total = track_str.split('/')
            audio['trkn'] = [(int(track_num), int(track_total))]
        else:
            audio['trkn'] = [(int(track_str), 0)]
    if get_value(meta, 'discNumber'):
        disc_str = str(meta['discNumber'])
        if '/' in disc_str:
            disc_num, disc_total = disc_str.split('/')
            audio['disk'] = [(int(disc_num), int(disc_total))]
        else:
            audio['disk'] = [(int(disc_str), 0)]
    if get_value(meta, 'composer'):
        audio['\xa9wrt'] = [meta['composer']]
    if get_value(meta, 'bpm'):
        audio['tmpo'] = [int(meta['bpm'])]
    if get_value(meta, 'copyright'):
        audio['cprt'] = [meta['copyright']]
    if get_value(meta, 'publisher'):
        audio['----:com.apple.iTunes:PUBLISHER'] = [
            MP4FreeForm(str(meta['publisher']).encode('utf-8'))
        ]

    # Comment
    comment_value = get_value(meta, 'comment')
    if comment_value is not None:
        audio['\xa9cmt'] = [comment_value]
    elif 'comment' in meta and meta['comment'] == '':
        if '\xa9cmt' in audio:
            del audio['\xa9cmt']

    # Lyrics
    if get_value(meta, 'lyrics'):
        audio['\xa9lyr'] = [meta['lyrics']]

    # Extended properties
    for field, prop in extended.items():
        # Handle both ExtendedProperty and string (backwards compat)
        if hasattr(prop, 'value'):
            value = prop.value
            mode = prop.mode
        else:
            value = str(prop)
            mode = 'overwrite'

        field_upper = field.upper()
        if field_upper in MP3TAG_TO_MP4:
            mp4_key = MP3TAG_TO_MP4[field_upper]
            # Check preserve mode
            if mode == 'preserve' and mp4_key in audio:
                continue
            if mp4_key.startswith('----:'):
                # Freeform atom
                audio[mp4_key] = [MP4FreeForm(value.encode('utf-8'))]
            elif mp4_key == 'disk':
                if '/' in value:
                    d_num, d_total = value.split('/')
                    audio['disk'] = [(int(d_num), int(d_total))]
                else:
                    audio['disk'] = [(int(value), 0)]
            elif mp4_key == 'cpil':
                audio['cpil'] = value.lower() in ('1', 'true', 'yes')
            else:
                audio[mp4_key] = [value]
        else:
            # Unknown field - write as freeform
            freeform_key = f'----:com.apple.iTunes:{field}'
            if mode == 'preserve' and freeform_key in audio:
                continue
            audio[freeform_key] = [MP4FreeForm(value.encode('utf-8'))]

    audio.save()


def main():
    if len(sys.argv) != 3:
        error_exit("Usage: tag_audio.py <audio_path> <meta_path>")

    audio_path = sys.argv[1]
    meta_path = sys.argv[2]

    # Load metadata
    meta = load_metadata(meta_path)
    extended = get_extended(meta)

    # Debug: print metadata being applied
    import os
    size_before = os.path.getsize(audio_path)
    print(f"Processing: {audio_path} (size: {size_before} bytes)", file=sys.stderr)
    print(f"Metadata: title={meta.get('title')}, artist={meta.get('artist')}, year={meta.get('year')}", file=sys.stderr)

    # Detect format from extension
    ext = Path(audio_path).suffix.lower()

    try:
        if ext == '.wav':
            tag_wav(audio_path, meta, extended)
        elif ext == '.mp3':
            tag_mp3(audio_path, meta, extended)
        elif ext == '.flac':
            tag_flac(audio_path, meta, extended)
        elif ext in ('.m4a', '.aac', '.mp4'):
            tag_m4a(audio_path, meta, extended)
        else:
            error_exit(f"Unsupported audio format: {ext}")

        size_after = os.path.getsize(audio_path)
        print(f"Successfully tagged {ext} file (size: {size_before} -> {size_after} bytes)", file=sys.stderr)
        print("OK")
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        error_exit(str(e))


if __name__ == '__main__':
    main()
