import { Component } from "react";

// An unexpected admin widget exception must not turn the entire workspace blank.
export default class AdminErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    if (import.meta.env?.DEV) console.error("Admin section failed:", error, info);
  }
  render() {
    if (this.state.error) return <div className="glass mt-5 space-y-3 p-5" role="alert">
      <h2 className="text-lg font-bold">This admin section could not be displayed.</h2>
      <p className="text-sm">The page is still available and your existing records were not changed by this display error.</p>
      <p className="break-words text-xs text-red-600 dark:text-red-400">{String(this.state.error.message || this.state.error)}</p>
      <button className="btn-primary" type="button" onClick={()=>this.setState({error:null})}>Retry section</button>
    </div>;
    return this.props.children;
  }
}
