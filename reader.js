import './view.js'
import { Overlayer } from './overlayer.js'


window.createReader = () => new Reader()

class Reader {
    style = {
        lineHeight: 1.4,
        justify: true,
        hyphenate: true,
        isDark: false,
        theme: {
           name: 'default',
           light: { fg: '#000000', bg: '#ffffff', link: '#0066cc' },
           dark: { fg: '#e0e0e0', bg: '#222222', link: '#88ccee' },
       },
    }

    layout = {
        gap: 0.06,
        maxInlineSize: 1440,
        maxBlockSize: 720,
        maxColumnCount: 2,
        flow: 'paginated',
    }

    annotations = new Map()
    annotationsByValue = new Map()
    
    async open(view, file) {
        this.view = view
        const book = await getBook(file)

        document.body.append(view)
        await view.open(book)

        this.setAppearance(this.style, this.layout)
        view.next()

        // load and show highlights embedded in the file by Calibre
        const bookmarks = await book.getCalibreBookmarks?.()
        if (bookmarks) {
            const { fromCalibreHighlight } = await import('./epubcfi.js')
            for (const obj of bookmarks) {
                if (obj.type === 'highlight') {
                    const value = fromCalibreHighlight(obj)
                    const color = obj.style.which
                    const note = obj.notes
                    const annotation = { value, color, note }
                    const list = this.annotations.get(obj.spine_index)
                    if (list) list.push(annotation)
                    else this.annotations.set(obj.spine_index, [annotation])
                    this.annotationsByValue.set(value, annotation)
                }
            }

            view.addEventListener('create-overlay', e => {
                const { index } = e.detail
                const list = this.annotations.get(index)
                if (list) for (const annotation of list)
                    view.addAnnotation(annotation)
            })

            view.addEventListener('draw-annotation', e => {
                const { draw, annotation } = e.detail
                const { color } = annotation
                draw(Overlayer.highlight, { color })
            })

            view.addEventListener('show-annotation', e => {
                const annotation = this.annotationsByValue.get(e.detail.value)
                if (annotation.note) alert(annotation.note)
            })
        }
    }

    setAppearance(style, layout) {
        Object.assign(this.style, style)
        const { theme } = style
        const $style = document.documentElement.style

        if (style.isDark) {
            $style.setProperty('--bg', theme.dark.bg)
            $style.setProperty('--fg', theme.dark.fg)
        }
        else {
            $style.setProperty('--bg', theme.light.bg)
            $style.setProperty('--fg', theme.light.fg)
        }

        const renderer = this.view?.renderer
        if (renderer) {
            renderer.setAttribute('flow', layout.flow)
            renderer.setAttribute('gap', layout.gap * 100 + '%')
            renderer.setAttribute('max-inline-size', layout.maxInlineSize + 'px')
            renderer.setAttribute('max-block-size', layout.maxBlockSize + 'px')
            renderer.setAttribute('max-column-count', layout.maxColumnCount)
            renderer.setStyles?.(getCSS(this.style))
        }

        document.body.classList.toggle('dark', this.style.isDark)
    }
}


// Helper functions
const isZip = async file => {
    const arr = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04
}

const makeZipLoader = async file => {
    const { configure, ZipReader, BlobReader, TextWriter, BlobWriter } =
        await import('./vendor/zip.js')
    configure({ useWebWorkers: false })
    const reader = new ZipReader(new BlobReader(file))
    const entries = await reader.getEntries()
    const map = new Map(entries.map(entry => [entry.filename, entry]))
    const load = f => (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null
    const loadText = load(entry => entry.getData(new TextWriter()))
    const loadBlob = load((entry, type) => entry.getData(new BlobWriter(type)))
    const getSize = name => map.get(name)?.uncompressedSize ?? 0
    return { entries, loadText, loadBlob, getSize }
}

const getFileEntries = async entry => entry.isFile ? entry
    : (await Promise.all(Array.from(
        await new Promise((resolve, reject) => entry.createReader()
            .readEntries(entries => resolve(entries), error => reject(error))),
        getFileEntries))).flat()

const makeDirectoryLoader = async entry => {
    const entries = await getFileEntries(entry)
    const files = await Promise.all(
        entries.map(entry => new Promise((resolve, reject) =>
            entry.file(file => resolve([file, entry.fullPath]),
                error => reject(error)))))
    const map = new Map(files.map(([file, path]) =>
        [path.replace(entry.fullPath + '/', ''), file]))
    const decoder = new TextDecoder()
    const decode = x => x ? decoder.decode(x) : null
    const getBuffer = name => map.get(name)?.arrayBuffer() ?? null
    const loadText = async name => decode(await getBuffer(name))
    const loadBlob = name => map.get(name)
    const getSize = name => map.get(name)?.size ?? 0
    return { loadText, loadBlob, getSize }
}

const isCBZ = ({ name, type }) =>
    type === 'application/vnd.comicbook+zip' || name.endsWith('.cbz')

const isFB2 = ({ name, type }) =>
    type === 'application/x-fictionbook+xml' || name.endsWith('.fb2')

const isFBZ = ({ name, type }) =>
    type === 'application/x-zip-compressed-fb2'
    || name.endsWith('.fb2.zip') || name.endsWith('.fbz')

const getBook = async file => {
    let book
    if (file.isDirectory) {
        const loader = await makeDirectoryLoader(file)
        const { EPUB } = await import('./epub.js')
        book = await new EPUB(loader).init()
    }
    else if (!file.size) throw new Error('File not found')
    else if (await isZip(file)) {
        const loader = await makeZipLoader(file)
        if (isCBZ(file)) {
            const { makeComicBook } = await import('./comic-book.js')
            book = makeComicBook(loader, file)
        } else if (isFBZ(file)) {
            const { makeFB2 } = await import('./fb2.js')
            const { entries } = loader
            const entry = entries.find(entry => entry.filename.endsWith('.fb2'))
            const blob = await loader.loadBlob((entry ?? entries[0]).filename)
            book = await makeFB2(blob)
        } else {
            const { EPUB } = await import('./epub.js')
            book = await new EPUB(loader).init()
        }
    } else {
        const { isMOBI, MOBI } = await import('./mobi.js')
        if (await isMOBI(file)) {
            const fflate = await import('./vendor/fflate.js')
            book = await new MOBI({ unzlib: fflate.unzlibSync }).open(file)
        } else if (isFB2(file)) {
            const { makeFB2 } = await import('./fb2.js')
            book = await makeFB2(file)
        }
    }
    if (!book) throw new Error('File type not supported')
    return book
}

const getCSS = ({ isDark, lineHeight, justify, hyphenate, theme }) => [`
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: 'only light';
        color: ${isDark ? theme.dark.fg : theme.light.fg};
    }
    a:any-link {
        color: ${isDark ? theme.dark.link : theme.light.link};
    }

    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }

    html, body, p, li, blockquote, dd {
        line-height: ${lineHeight};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        orphans: 2;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
        tab-size: 2;
    }
`, `
    p, li, blockquote, dd {
        line-height: ${lineHeight};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
    }
`]
