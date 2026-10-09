All tappable elements must use PressableScale from src/components/ui. Do not use TouchableOpacity or bare Pressable for buttons.

Scope exception: only rectangular and pill buttons use this animation. Keep tappable cards and their arrow areas, gesture surfaces, and backdrops unchanged. Today Mark as taken now uses PressableScale; its check circle is the undo action. Small standalone icon buttons use scaleTo={0.88}; preserve their visual dimensions and provide at least a 44x44 touch target through hitSlop when needed.
