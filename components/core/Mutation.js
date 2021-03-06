// @flow
import * as React from 'react';
import createReactContext, { type Context } from 'create-react-context';
import type { Disposable, Environment, PayloadError } from 'react-relay';
import { ErrorPopupConsumer } from './ErrorPopup';
import createRelayEnvironment from '../app/createRelayEnvironment';
import { parsePayloadErrors, type Errors } from '../../server/error';

type Value = {|
  environment: Environment,
|};

const MutationContext: Context<Value> = createReactContext({
  environment: createRelayEnvironment(),
});

export const MutationProvider = MutationContext.Provider;

export type Commit<Input, Response> = (
  environment: Environment,
  input: Input,
  onCompleted: (
    response: Response,
    payloadErrors: ?Array<PayloadError>,
  ) => void,
  onError: (error: any) => void,
) => Disposable;

type MutationProps = {|
  children: (*) => React.Node,
|};

type MutationState = {|
  pending: boolean,
|};

// Maybe one day I will rewrite it to higher order component, but not today.
// Function as child component is easier to write, use, and Flow type.
class Mutation extends React.PureComponent<MutationProps, MutationState> {
  state = { pending: false };

  componentWillUnmount() {
    this.disposables.forEach(disposable => disposable.dispose());
  }

  disposables: Array<Disposable> = [];

  mutate = (environment: *, showError: *) => <Variables, Response>(
    commit: Commit<Variables, Response>,
    variables: Variables,
    onCompleted?: (response: Response) => void,
    onError?: (errors: Errors<Variables>) => void,
  ) => {
    this.setState({ pending: true });

    const disposable = commit(
      environment,
      variables,
      (response, payloadErrors) => {
        this.setState({ pending: false });
        if (!payloadErrors) {
          if (onCompleted) onCompleted(response);
          return;
        }
        const { errors, error } = parsePayloadErrors(payloadErrors);
        if (onError) onError(errors);
        if (error) showError(error);
      },
      error => {
        this.setState({ pending: false });
        if (onError) onError({});
        showError({ type: 'unknown', message: error.message });
      },
    );
    this.disposables.push(disposable);
  };

  render() {
    return (
      <MutationContext.Consumer>
        {({ environment }) => (
          <ErrorPopupConsumer>
            {({ showError }) =>
              this.props.children({
                mutate: this.mutate(environment, showError),
                pending: this.state.pending,
              })
            }
          </ErrorPopupConsumer>
        )}
      </MutationContext.Consumer>
    );
  }
}

export default Mutation;
