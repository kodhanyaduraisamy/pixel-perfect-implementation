import type { ExtractedChunk } from "./extract";

/** Clearly labelled demo material. Loaded only when the student asks for it. */
export const DEMO_COURSE_NAME = "DEMO · Intro to Neural Networks";

export const DEMO_DOCUMENTS: { name: string; kind: "pdf" | "slides" | "transcript"; chunks: ExtractedChunk[] }[] = [
  {
    name: "[DEMO] Lecture Notes – Neural Network Foundations.pdf",
    kind: "pdf",
    chunks: [
      { kind: "text", page: 1, content: "A perceptron is the simplest neural unit. It computes a weighted sum of its inputs, adds a bias term, and passes the result through a step function. If the weighted sum plus bias is greater than zero the perceptron outputs 1, otherwise it outputs 0. A single perceptron can only separate classes that are linearly separable; it cannot represent the XOR function." },
      { kind: "text", page: 2, content: "Activation functions introduce non-linearity. The sigmoid function maps any real number into the range (0, 1) and is defined as 1 / (1 + e^-x). The ReLU (rectified linear unit) outputs max(0, x). ReLU is preferred in deep networks because it does not saturate for positive inputs, which reduces the vanishing gradient problem. Sigmoid gradients become very small for large positive or negative inputs." },
      { kind: "text", page: 3, content: "A multilayer perceptron stacks layers of neurons: an input layer, one or more hidden layers, and an output layer. With at least one hidden layer and a non-linear activation, a network can approximate any continuous function on a bounded domain — this is the universal approximation theorem. Hidden layers learn intermediate representations of the input." },
      { kind: "text", page: 4, content: "Gradient descent minimises a loss function by repeatedly moving the parameters in the direction of the negative gradient. The learning rate controls the step size. If the learning rate is too large, training can diverge or oscillate; if it is too small, training converges very slowly. Stochastic gradient descent estimates the gradient using a small random mini-batch of training examples instead of the full dataset." },
      { kind: "text", page: 5, content: "Backpropagation computes the gradient of the loss with respect to every weight by applying the chain rule backwards through the network, from the output layer to the input layer. The forward pass computes activations and the loss; the backward pass propagates error signals. Backpropagation itself does not update weights — an optimiser such as gradient descent uses the gradients it produces." },
      { kind: "text", page: 6, content: "Overfitting occurs when a model learns noise in the training data and performs poorly on unseen data: training loss keeps falling while validation loss starts rising. Common remedies are collecting more data, L2 regularisation (weight decay), dropout, and early stopping. Dropout randomly sets a fraction of activations to zero during training, which prevents units from co-adapting." },
    ],
  },
  {
    name: "[DEMO] Slides – Training Deep Networks.pptx",
    kind: "slides",
    chunks: [
      { kind: "slide", slide: 1, content: "Training Deep Networks\nLoss functions, optimisers and regularisation" },
      { kind: "slide", slide: 2, content: "Loss functions\nMean squared error is used for regression. Cross-entropy loss is used for classification and is paired with a softmax output layer, which turns logits into a probability distribution that sums to 1." },
      { kind: "slide", slide: 3, content: "Optimisers\nMomentum accumulates an exponentially decaying average of past gradients to accelerate descent. Adam combines momentum with per-parameter adaptive learning rates.\nSpeaker notes: Adam is a good default; tune the learning rate first." },
      { kind: "slide", slide: 4, content: "Diagnosing training\nTraining loss down, validation loss up → overfitting. Both losses high → underfitting: increase model capacity or train longer." },
    ],
  },
  {
    name: "[DEMO] Lecture Video Transcript – Backpropagation Walkthrough.vtt",
    kind: "transcript",
    chunks: [
      { kind: "transcript", ts_start: 0, ts_end: 72, content: "Welcome back. Today we walk through backpropagation step by step. Remember the forward pass: each layer multiplies its inputs by weights, adds a bias, and applies an activation. At the end we compute the loss by comparing the prediction to the target." },
      { kind: "transcript", ts_start: 72, ts_end: 165, content: "Now the backward pass. We start with the derivative of the loss with respect to the output. Using the chain rule, we multiply by the derivative of the activation, and then by the input to that weight. That gives the gradient for each weight in the last layer." },
      { kind: "transcript", ts_start: 165, ts_end: 248, content: "We keep going backwards, layer by layer, reusing the error signals we already computed. This reuse is why backpropagation is efficient: it computes all gradients in roughly the cost of one extra forward pass. A common bug is forgetting to reset the gradients between mini-batches." },
      { kind: "transcript", ts_start: 248, ts_end: 320, content: "Finally, the vanishing gradient problem: with sigmoid activations, gradients shrink as they flow back through many layers, so early layers learn very slowly. Using ReLU activations and careful weight initialisation helps keep gradients healthy." },
    ],
  },
];

/** Evaluation test set — designed against the demo course above. */
export const EVAL_TEST_SET: { id: string; question: string; answerable: boolean; reference: string | null }[] = [
  { id: "a1", question: "Why can't a single perceptron learn XOR?", answerable: true, reference: "A single perceptron can only separate linearly separable classes, and XOR is not linearly separable." },
  { id: "a2", question: "Why is ReLU preferred over sigmoid in deep networks?", answerable: true, reference: "ReLU does not saturate for positive inputs, reducing the vanishing gradient problem; sigmoid gradients become very small for large inputs." },
  { id: "a3", question: "What happens if the learning rate is too large?", answerable: true, reference: "Training can diverge or oscillate." },
  { id: "a4", question: "Does backpropagation update the weights?", answerable: true, reference: "No. Backpropagation computes gradients via the chain rule; an optimiser such as gradient descent uses them to update weights." },
  { id: "a5", question: "How can I tell if my model is overfitting?", answerable: true, reference: "Training loss keeps falling while validation loss rises." },
  { id: "a6", question: "What does dropout do?", answerable: true, reference: "Dropout randomly sets a fraction of activations to zero during training to prevent co-adaptation of units." },
  { id: "u1", question: "Who invented the transformer architecture and in which year?", answerable: false, reference: null },
  { id: "u2", question: "What is the Black–Scholes formula used for in finance?", answerable: false, reference: null },
  { id: "u3", question: "How many parameters does GPT-3 have?", answerable: false, reference: null },
  { id: "u4", question: "What is the capital of Australia?", answerable: false, reference: null },
];
