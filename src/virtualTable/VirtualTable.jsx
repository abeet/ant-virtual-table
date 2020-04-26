import React, { PureComponent, Fragment } from 'react'
import ReactDOM from 'react-dom'
import throttle from 'lodash/throttle';
import BaseTable from './BaseTable'

class VirtualTable extends PureComponent {
  static FillNode ({ height, node, marginTop, marginBottom }) {
    if (node) {
      marginTop = marginTop || 0
      marginBottom = marginBottom || 0
      height = height || 0
      return ReactDOM.createPortal(
        <div style={{ height: `${height}px`, marginTop: `${marginTop}px`, marginBottom: `${marginBottom}px` }} />,
        node
      )
    }
    return null
  }
  constructor (props) {
    super(props)
    this.state = {
      startIndex: 0,
      visibleRowCount: 0,
      thresholdCount: 40,
      rowHeight: 0,
      topBlankHeight: 0,
      bottomBlankHeight: 0,
      maxTotalHeight: 15000000
    }
  }

  componentDidMount () {
    // 普通table布局
    this.refScroll = ReactDOM.findDOMNode(this).getElementsByClassName('ant-table-body')[0]
    // 固定列的布局
    const fixedEles = ReactDOM.findDOMNode(this).getElementsByClassName('ant-table-body-inner')
    this.refFixedLeftScroll = fixedEles && fixedEles.length ? fixedEles[0] : null
    this.refFixedRightScroll = fixedEles && fixedEles.length > 1 ? fixedEles[1] : null

    this.listenEvent = throttle(this.handleScrollEvent, 50)

    if (this.refScroll) {
      this.refScroll.addEventListener('scroll', this.listenEvent)
    }

    this.createTopFillNode()
    this.createBottomFillNode()
    // 初始化设置滚动条
    this.setRowHeight()
    this.handleScrollEvent()
  }

  componentDidUpdate(prevProps) {
    const { dataSource } = prevProps
    const { dataSource: tdataSource } = this.props
    if (dataSource && dataSource.length != tdataSource.length) {
      this.refScroll.scrollTop = 0
      this.handleScroll(dataSource.length)
    }
  }

  componentWillUnmount () {
    if (this.refScroll) {
      this.refScroll.removeEventListener('scroll', this.listenEvent)
    }
  }

  createTopFillNode () {
    if (this.refScroll) {
      const ele = document.createElement('div')
      this.refScroll.insertBefore(ele, this.refScroll.firstChild)
      this.refTopNode = ele
    }
    if (this.refFixedLeftScroll) {
      const ele = document.createElement('div')
      this.refFixedLeftScroll.insertBefore(ele, this.refFixedLeftScroll.firstChild)
      this.refFixedLeftTopNode = ele
    }
    if (this.refFixedRightScroll) {
      const ele = document.createElement('div')
      this.refFixedRightScroll.insertBefore(ele, this.refFixedRightScroll.firstChild)
      this.refFixedRightTopNode = ele
    }
  }

  createBottomFillNode () {
    if (this.refScroll) {
      const ele = document.createElement('div')
      this.refScroll.appendChild(ele)
      this.refBottomNode = ele
    }
    if (this.refFixedLeftScroll) {
      const ele = document.createElement('div')
      this.refFixedLeftScroll.appendChild(ele)
      this.refFixedLeftBottomNode = ele
    }
    if (this.refFixedRightScroll) {
      const ele = document.createElement('div')
      this.refFixedRightScroll.appendChild(ele)
      this.refFixedRightBottomNode = ele
    }
  }

  setRowHeight () {
    this.refTable = this.refScroll.getElementsByTagName('table')[0]
    // this.refFixedLeftTable = this.refFixedLeftScroll.getElementsByTagName('table')[0]
    if (this.refTable) {
      const tr = this.refTable.getElementsByTagName('tr')[0]
      const rowHeight = (tr && tr.clientHeight) || 0
      this.state.rowHeight = rowHeight
    }
  }

  handleScrollEvent = (e) => {
    const { dataSource } = this.props
    this.handleScroll((dataSource || []).length)
  }
  
  handleScroll = (length) => {
    const { rowHeight, maxTotalHeight } = this.state
    if (rowHeight && length) {
      const visibleHeight = this.refScroll.clientHeight // 显示的高度
      const scrollTop = this.refScroll.scrollTop // 滑动的距离
      this.handleBlankHeight(length, rowHeight, maxTotalHeight, visibleHeight, scrollTop) 
    } else {
      this.setRowHeight()
    }
  }

  getIndexByScrollTop(rowHeight, scrollTop) {
    const index = (scrollTop - scrollTop % rowHeight) / rowHeight
    return index
  }

  handleBlankHeight(length, rowHeight, maxTotalHeight, visibleHeight, scrollTop) {
    let oriRowHeight = rowHeight
    let totalHeight = length * rowHeight
    let isBigData = false
    if (totalHeight > maxTotalHeight) {
      isBigData = true
      totalHeight = maxTotalHeight
      rowHeight = totalHeight / length
      scrollTop = scrollTop > maxTotalHeight ? maxTotalHeight : scrollTop
    }
    if (length >= 10000) {
      isBigData = true
    }
    let topBlankHeight, bottomBlankHeight, startIndex, visibleRowCount
    startIndex = this.getIndexByScrollTop(rowHeight, scrollTop)
    visibleRowCount = Math.ceil(visibleHeight / oriRowHeight)
    topBlankHeight = rowHeight * startIndex
    topBlankHeight = this.getValidValue(topBlankHeight, 0, totalHeight)
    bottomBlankHeight = totalHeight - topBlankHeight - visibleHeight
    bottomBlankHeight = bottomBlankHeight > 0 ? bottomBlankHeight : 0

    const slideUpHeight = Math.abs(topBlankHeight - this.state.topBlankHeight)
    const slideDownHeight = Math.abs(bottomBlankHeight - this.state.bottomBlankHeight)
    
    if (!this.lastSlideUpHeight) {
      this.sameSlideHeightCount = 0
      this.lastSlideUpHeight = slideUpHeight
    } else if (this.lastSlideUpHeight === slideUpHeight) {
      this.sameSlideHeightCount++
    } else {
      this.lastSlideUpHeight = slideUpHeight
      this.sameSlideHeightCount = 0
    }

    let isValid = slideUpHeight >= rowHeight
    isValid = isValid || slideDownHeight >= rowHeight
    isValid = isValid || startIndex === 0
    if (isValid) {
      startIndex = startIndex - 5
      visibleRowCount = visibleRowCount + 5
      this.setState({
        startIndex,
        visibleRowCount,
        topBlankHeight,
        bottomBlankHeight
      })
      
      if (isBigData && this.sameSlideHeightCount >= 1) { // 防止大数据持续滚动期间出现空白的问题
        this.refScroll.scrollTop = scrollTop
        this.sameSlideHeightCount = 0
      }
    }
  }

  getValidValue (val, min = 0, max = 40) {
    if (val < min) {
      return min
    } else if (val > max) {
      return max
    }
    return val
  }

  render () {
    const { dataSource, ...rest } = this.props
    const { topBlankHeight, bottomBlankHeight, startIndex, visibleRowCount, rowHeight, thresholdCount } = this.state
    const { length } = dataSource || []
    let startCount = length - visibleRowCount
    startCount = startCount > 0 ? startCount : length
    let startIn = this.getValidValue(startIndex, 0, startCount)
    let endIn = startIndex + visibleRowCount
    if (!endIn) { // 初始化渲染数据
      endIn = length > thresholdCount ? thresholdCount : length
    }
    endIn = this.getValidValue(endIn, startIndex, length)
    const renderSource = (dataSource || []).slice(startIn, endIn)

    return (
      <Fragment>
        <VirtualTable.FillNode
          height={topBlankHeight}
          node={this.refTopNode}
        />
        <BaseTable
          {...rest}
          dataSource={dataSource}
          renderSource = {renderSource}
        />
        <VirtualTable.FillNode
          height={bottomBlankHeight}
          node={this.refBottomNode}
        />

        {
          /**fixed 针对固定列的*/
          <Fragment>
            <VirtualTable.FillNode
              height={topBlankHeight}
              node={this.refFixedLeftTopNode}
            />
            <VirtualTable.FillNode
              height={bottomBlankHeight}
              node={this.refFixedLeftBottomNode}
            />
            <VirtualTable.FillNode
              height={topBlankHeight}
              node={this.refFixedRightTopNode}
            />
            <VirtualTable.FillNode
              height={bottomBlankHeight}
              node={this.refFixedRightBottomNode}
            />
          </Fragment>
        }
      </Fragment>
    )
  }
}

export default VirtualTable
