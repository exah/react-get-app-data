// @flow

import type {
  GetDataFn,
  ShouldDataUpdateFn,
  DataStoreType,
  WrappedComponentType,
  HOC,
  Props,
  State
} from './types'

import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { shallowEqual, wrapDisplayName } from 'recompose'
import { DataConsumer } from './context'
import { defaultDataStore } from './data-store'

import {
  IS_CLIENT,
  IS_SERVER,
  INITIAL_ID
} from './constants'

const defaultGetData: GetDataFn = () => Promise.resolve(false)

const defaultShouldDataUpdate: ShouldDataUpdateFn = (prev, next) => {
  if (prev.match && prev.location) {
    return !(
      shallowEqual(prev.match.params, next.match.params) &&
      prev.location.pathname === next.location.pathname &&
      prev.location.search === next.location.search
    )
  }

  return prev.id !== next.id
}

const defaultMergeProps = ({ dataStore, ...props }, state): Props => ({
  ...props,
  ...(Array.isArray(state.data) ? { data: state.data } : state.data),
  isLoading: props.isLoading || state.isLoading,
  error: state.error || props.error || null
})

/**
 * Higher-Order Component for getting async data for initial component props and in subsequent updates.
 *
 * ```js
 * const Comp = withData(getData?, shouldDataUpdate?, mergeProps?)(TargetComp)
 * ```
 *
 * @param getData — Function that returns promise with props for wrapped component
 *
 * @return — [Higher-Order Component](https://reactjs.org/docs/higher-order-components.html)
 *
 * @example
 *
 * import { withData } from 'react-get-app-data'
 *
 * const Page = ({ message }) => (
 *   <div>
 *     {message}
 *   </div>
 * )
 *
 * export default withData((contextAndProps, prevData) =>
 *   Promise.resolve({ message: 'ok' })
 * )(Page)
 *
 * @example
 *
 * import React from 'react'
 * import { withData } from 'react-get-app-data'
 *
 * class Page extends React.Component {
 *   // Same as `withData` first argument
 *   static async getData (contextAndProps, prevData) {
 *     return {
 *       name: 'John'
 *     }
 *   }
 *   render () {
 *     return (
 *       <div>
 *         Hello {this.props.name}!
 *       </div>
 *     )
 *   }
 * }
 *
 * export default withData()(Page)
 */

const withData = (
  getData: GetDataFn,
  shouldDataUpdate: ShouldDataUpdateFn = defaultShouldDataUpdate,
  mergeProps: (props: Props, state: State) => Props = defaultMergeProps
): HOC => (WrappedComponent: WrappedComponentType) => {
  let id = INITIAL_ID
  let unmountedProps = null

  const getDataPromise = getData || WrappedComponent.getData || defaultGetData

  const getDataHandler = (context, prevData) => {
    const promise = getDataPromise({
      isClient: IS_CLIENT,
      isServer: IS_SERVER,
      ...context
    }, prevData)

    promise.then((data) => data && context.dataStore.save(id, data))

    return promise
  }

  class Data extends PureComponent<any, any> {
    static displayName = wrapDisplayName(
      WrappedComponent,
      'withData'
    )
    static defaultProps = {
      dataStore: defaultDataStore
    }
    static propTypes = {
      dataStore: PropTypes.shape({
        save: PropTypes.func.isRequired,
        nextId: PropTypes.func.isRequired,
        getById: PropTypes.func.isRequired
      })
    }
    constructor (props) {
      super(props)

      if (
        id !== INITIAL_ID &&
        unmountedProps != null &&
        shouldDataUpdate(unmountedProps, props)
      ) {
        id = INITIAL_ID
      }

      if (!id) {
        id = props.dataStore.nextId()
      }

      this.state = {
        isLoading: false,
        error: null,
        data: props.dataStore.getById(id)
      }
    }
    _handleRequest = (requestPromise) => {
      this.setState({ isLoading: true })

      requestPromise
        .then((data) => data && this.setState({ data }))
        .catch((error) => this.setState({ error }))
        .then(() => this.setState({ isLoading: false }))

      return requestPromise
    }
    getInitialData = (serverContext) => getDataHandler(
      { ...serverContext, ...this.props },
      this.state.data
    )
    getData = () => this._handleRequest(
      getDataHandler(
        this.props,
        this.state.data
      )
    )
    componentDidMount () {
      if (this.props.dataStore.getById(id) == null) {
        this.getData()
      }
    }
    componentDidUpdate (prevProps) {
      if (shouldDataUpdate(prevProps, this.props)) {
        this.getData()
      }
    }
    componentWillUnmount () {
      unmountedProps = this.props
    }
    render () {
      return (
        <WrappedComponent {...mergeProps(this.props, this.state)} />
      )
    }
  }

  return (props: Object) => (
    <DataConsumer>
      {(dataStore: DataStoreType) => <Data {...props} dataStore={dataStore} />}
    </DataConsumer>
  )
}

export {
  withData
}
