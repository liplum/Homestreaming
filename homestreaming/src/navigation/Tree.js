import React from 'react'
import { emitter } from "../Event"
import { Tree } from 'antd'
const { DirectoryTree } = Tree;

export class FileTreeNavigation extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      delegate: undefined,
    }
  }

  componentDidMount() {
    emitter.on("go-next", this.onGoNext)
    emitter.on("go-previous", this.onGoPrevious)
    this.updateAndNotify()
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.searchDelegate !== this.props.searchDelegate ||
      prevProps.fileTree !== this.props.fileTree
    ) {
      this.updateAndNotify()
    }
  }

  updateAndNotify = () => {
    const fileTree = this.props.fileTree
    if (!fileTree) return
    const delegate = createFileTreeDelegate(fileTree.files, fileTree.name)
    if (this.props.searchDelegate) {
      const tree = filterFileTree(delegate.renderTree, this.props.searchDelegate,
        (id) => delegate.id2File.get(id)
      )
      delegate.renderTree = tree
    }
    this.setState({
      delegate
    })
  }

  componentWillUnmount() {
    emitter.off("go-next", this.onGoNext)
    emitter.off("go-previous", this.onGoPrevious)
  }

  onNodeSelect(key) {
    this.setState({
      selected: key
    })
    if (typeof key === "string") {
      key = parseInt(key)
      if (isNaN(key)) return
    }
    const file = this.state.delegate.id2File.get(key)
    if (file) this.props.onSelectFile?.({
      key,
      ...file,
    })
  }

  render() {
    const delegate = this.state.delegate
    if (!delegate) return
    const lastSelectedFile = this.props.lastSelectedFile
    return (
      <DirectoryTree
        style={{
          backgroundColor: "#0A0A0A",
          color: "#FAFAFA",
          fontSize: "14pt",
          height: "95vh",
          overflow: "auto",
        }}
        showLine={true}
        showIcon={false}
        defaultSelectedKeys={[lastSelectedFile?.nodeId]}
        defaultExpandedKeys={lastSelectedFile?.tracking}
        onSelect={(keys, _) => {
          if (keys.length > 0) this.onNodeSelect(keys[0])
        }}
        treeData={this.state.delegate.renderTree.children}
      />
    );
  }

  selectFile(key, file) {
    this.props.onSelectFile?.({
      ...file,
      key,
    })
  }
  onGoNext = (curFile) => {
    this.onGoImage(curFile, +1)
  }
  onGoPrevious = (curFile) => {
    this.onGoImage(curFile, -1)
  }

  onGoImage(curFile, delta) {
    if (!(curFile && "key" in curFile)) return
    const delegate = this.state.delegate
    let nextKey = curFile.key + delta
    while (0 <= nextKey && nextKey < this.state.delegate.maxId) {
      const next = delegate.id2File.get(nextKey)
      if (!next) {
        nextKey += delta
      } else {
        this.selectFile(nextKey, next)
        return
      }
    }
  }
}

/**
 *  @author chatGPT
 */
function filterFileTree(tree, searchDelegate, getFileById) {
  function filterTree(tree) {
    // base case: leaf node
    if (!tree.children) {
      const file = getFileById(tree.key)
      return searchDelegate(file) ? tree : null
    }

    // filter children recursively
    const filteredChildren = tree.children.map(child => filterTree(child)).filter(child => child !== null)

    // return null if no children match
    if (filteredChildren.length === 0) {
      return null
    }

    // create a new node with the filtered children
    return {
      ...tree,
      children: filteredChildren
    }
  }
  let root = filterTree(tree)
  if (!root) {
    root = {
      ...tree,
      children: []
    }
  }
  return root
}

function createFileTreeDelegate(rootFileTree, rootName = "") {
  const rootChildren = []
  let key = 0
  const rootObj = {
    key: key++,
    title: rootName,
    children: rootChildren
  }
  const id2File = new Map()
  function createNode(parentUrl, parentKeys, children, fileTree) {
    const entries = Object.entries(fileTree)
    reorder(entries)
    for (const [name, file] of entries) {
      let curKey = key++
      const path = parentUrl.length > 0 ? `${parentUrl}/${name}` : name
      if (file instanceof Object) {
        // if file is an object, it presents a directory
        const myChildren = []
        const obj = {
          key: curKey,
          title: name,
          selectable: false,
          children: myChildren
        }
        children.push(obj)
        createNode(path, [...parentKeys, curKey], myChildren, file)
      } else {
        id2File.set(curKey, {
          name,
          path: path,
          type: file,
          selectable: false,
          tracking: [...parentKeys, curKey],
        })
        // otherwise, it presents a file
        children.push({
          key: curKey,
          isLeaf: true,
          title: name,
        })
      }
    }
  }
  createNode("", [rootObj.id], rootChildren, rootFileTree)
  return {
    renderTree: rootObj,
    id2File,
    maxId: key,
  }
}

/**
 *  @author chatGPT
 */
function reorder(array) {
  array.sort((a, b) => {
    const [fileNameA, fileA] = a;
    const [fileNameB, fileB] = b;
    // if both fileA and fileB are directories
    if (typeof fileA === "object" && typeof fileB === "object") {
      // just compare in string
      return fileNameA.localeCompare(fileNameB)
    }

    const extensionA = fileNameA.split('.').pop();
    const extensionB = fileNameB.split('.').pop();

    // Group files with the same extension together
    if (extensionA !== extensionB) {
      return extensionA.localeCompare(extensionB);
    }

    // Compare files without the extension
    const fileNameOnlyA = fileNameA.replace(/\.[^/.]+$/, '');
    const fileNameOnlyB = fileNameB.replace(/\.[^/.]+$/, '');

    // Check if both file names contain only numbers
    if (/^\d+$/.test(fileNameOnlyA) && /^\d+$/.test(fileNameOnlyB)) {
      return parseInt(fileNameOnlyA) - parseInt(fileNameOnlyB);
    }

    // Check if both file names have a number in them
    const numberA = parseInt(fileNameOnlyA.match(/\d+/));
    const numberB = parseInt(fileNameOnlyB.match(/\d+/));
    if (numberA && numberB && numberA !== numberB) {
      return numberA - numberB;
    }

    // Use lexicographic order as a fallback
    return fileNameA.localeCompare(fileNameB);
  });
}