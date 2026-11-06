import { defineDurableState } from "void/durable";

// The lib check imports Counter directly: the declaring file is the
// binding — no separate service wiring needed. The default export is
// what the platform scans for to create the binding.
export const Counter = defineDurableState({
  initialState: { count: 0 },
  methods: {
    bump(context) {
      context.state.count += 1;
      return context.state.count;
    },
    read(context) {
      return context.state.count;
    },
  },
});
export default Counter;
