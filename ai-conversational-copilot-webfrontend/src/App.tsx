//App.tsx file content
import React, { Component, RefObject } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import {
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  DefaultButton,
  TextField,
  Panel,
  Pivot,
  PivotItem,
  Label,
} from "@fluentui/react";
import { Toggle } from "@fluentui/react/lib/Toggle";
import {
  getKeyPhrases,
  getTokenOrRefresh,
  getGPTCustomPromptCompletion,
  gptLiveGuidance,
} from "./api/backend_api_orchestrator.ts";
import {
  getImageSasUrls,
  getGPTVInsights,
} from "./api/backend_api_orchestrator.ts";
import { ResultReason } from "microsoft-cognitiveservices-speech-sdk";
import "./App.css";
import { Delete24Regular } from "@fluentui/react-icons";
import * as speechsdk from "microsoft-cognitiveservices-speech-sdk";
import SpokenLanguageOptions from "./AppSettings.tsx";
import { ScenarioOptions } from "./AppSettings.tsx";
import { insuranceConversationTemplate } from "./ConversationTemplates";
import { Header } from "./Components/Header/index.tsx";

let recognizer: any;
// Define an interface for the image object
interface Image {
  name: string;
  sasUrl: string;
  imageInsights: string;
}

interface AppState {
  displayText: string;
  displayNLPOutput: string;
  value: string;
  displayKeyPhrases: string;
  displayPiiText: string;
  gptInsightsOutput: string;
  transcriptEventCount: number;
  isSettingsPanelOpen: boolean;
  conversationTemplate: string;
  copilotChecked: boolean;
  agentGuidance: string;
  taskCompleted: string;
  spokenLanguage: string;
  imageList: Image[];
  selectedImage: string;
  caseNumber: number;
  gptvInsights: string;
  showPhotoPanel: boolean;
  showPromptPanel: boolean;
  showTranscriptPanel: boolean;
  showPIIRedactedTranscript: boolean;
  customInstructions: React.ReactElement;
}

export default class App extends Component<{}, AppState> {
  private containerRef: RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);
    this.containerRef = React.createRef();
    this.state = {
      value: "",
      displayText:
        "Speak to your microphone or copy/paste conversation transcript here",
      displayNLPOutput: "",
      customInstructions: <></>,
      displayKeyPhrases: "",
      displayPiiText: "",
      gptInsightsOutput: "",
      transcriptEventCount: 0,
      isSettingsPanelOpen: false,
      conversationTemplate: insuranceConversationTemplate,
      agentGuidance: "",
      taskCompleted: "",
      spokenLanguage: "en-US",
      selectedImage: "",
      imageList: [],
      caseNumber: Date.now(),
      gptvInsights: "",
      copilotChecked: false,
      showPhotoPanel: false,
      showPromptPanel: false,
      showTranscriptPanel: true,
      showPIIRedactedTranscript: true,
    };
  }

  handleSpokenLangDropdownChange = (
    event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ) => {
    if (option) {
      this.setState({ spokenLanguage: option.key as string });
    } else {
      this.setState({ spokenLanguage: "en-US" });
    }
  };

  handleToggleChange = () => {
    this.setState((prevState) => ({
      copilotChecked: !prevState.copilotChecked,
    }));
  };

  handleTranscriptPanelToggleChange = () => {
    this.setState((prevState) => ({
      showTranscriptPanel: !prevState.showTranscriptPanel,
    }));
  };

  handlePIITranscriptToggleChange = () => {
    this.setState((prevState) => ({
      showPIIRedactedTranscript: !prevState.showPIIRedactedTranscript,
    }));
  };

  handlePhotoPanelToggleChange = () => {
    this.setState((prevState) => ({
      showPhotoPanel: !prevState.showPhotoPanel,
    }));
  };

  handlePromptPanelToggleChange = () => {
    this.setState((prevState) => ({
      showPromptPanel: !prevState.showPromptPanel,
    }));
  };

  scrollLeft = () => {
    if (this.containerRef.current) {
      this.containerRef.current.scrollLeft -= 200; //Adjust as needed
    }
  };

  scrollRight = () => {
    if (this.containerRef.current) {
      this.containerRef.current.scrollLeft += 200; //Adjust as needed
    }
  };

  async componentDidMount() {
    // check for valid speech key/region
    const tokenRes = await getTokenOrRefresh();
    if (tokenRes.authToken === null) {
      this.setState({ displayText: "ERROR: " + tokenRes.error });
    }
  }

  async sttFromMic() {
    const tokenObj = await getTokenOrRefresh();
    const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
      tokenObj.authToken as string,
      tokenObj.region as string
    );
    speechConfig.speechRecognitionLanguage = this.state.spokenLanguage;
    const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
    recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
    this.setState({
      displayText:
        "Speak to your microphone or copy/paste conversation transcript here",
    });

    let resultText = "";
    let nlpText = "";
    let keyPhraseText = "";
    let piiText = "";

    recognizer.sessionStarted = (s: any, e: any) => {};

    recognizer.recognized = async (s: any, e: any) => {
      if (e.result.reason === ResultReason.RecognizedSpeech) {
        resultText += `\n${e.result.text}`;
        this.setState({ displayText: resultText });
        this.setState({
          transcriptEventCount: this.state.transcriptEventCount + 1,
        });

        (
          document.getElementById("transcriptTextarea") as HTMLTextAreaElement
        ).value = resultText;
        const nlpObj = await getKeyPhrases(e.result.text);
        const entityText = nlpObj.entityExtracted;
        if (entityText.length > 12) {
          nlpText += entityText;
          this.setState({ displayNLPOutput: nlpText.replace("<br/>", "\n") });
        }
        const keyPhraseOut = JSON.stringify(nlpObj.keyPhrasesExtracted);
        if (keyPhraseOut.length > 15) {
          keyPhraseText += "\n" + keyPhraseOut;
          this.setState({ displayKeyPhrases: keyPhraseText });
        }
        const piiOut = nlpObj.piiExtracted;
        if (piiOut.length > 21) {
          piiText += "\n" + piiOut;
          this.setState({ displayPiiText: piiText.replace("<br/>", "\n") });
        }
        if (
          this.state.transcriptEventCount % 2 === 0 &&
          this.state.copilotChecked
        ) {
          this.gptLiveGuidance();
        }
      } else if (e.result.reason === ResultReason.NoMatch) {
        resultText += `\n`;
      }
    };
    recognizer.startContinuousRecognitionAsync();
  }

  async stopRecording() {
    recognizer.stopContinuousRecognitionAsync();
    if (this.state.copilotChecked) {
      this.gptLiveGuidance();
    }
  }

  async agentAssistDebug() {
    if (this.state.copilotChecked) {
      this.gptLiveGuidance();
    }
  }

  async gptCustomPromptCompetion() {
    var customPromptText = (
      document.getElementById("customPromptTextarea") as HTMLTextAreaElement
    ).value;
    var transcriptInputForPmt = this.state.displayText;
    const gptObj = await getGPTCustomPromptCompletion(
      transcriptInputForPmt,
      customPromptText
    );
    const gptText = gptObj.data.text;
    try {
      this.setState({ gptInsightsOutput: gptText.replace("\n\n", "") });
    } catch (error) {
      this.setState({ gptInsightsOutput: gptObj.data });
    }
  }

  async gptLiveGuidance() {
    var conversationTemplate = this.state.conversationTemplate;
    var transcriptText = this.state.displayText;
    const gptObj = await gptLiveGuidance(transcriptText, conversationTemplate);
    const gptText = gptObj.data.message.content;
    const regex = /Addressed Questions(.*?)Unaddressed Questions(.*)/s;
    var contentBetweenSections = "";
    var contentAfterSecondSection = "";
    const match = gptText.match(regex);
    if (match) {
      contentBetweenSections = match[2].trim();
      contentAfterSecondSection = match[1].trim();
    } else {
      contentBetweenSections = gptText;
      contentAfterSecondSection = gptText;
    }

    try {
      this.setState({ agentGuidance: contentBetweenSections });
      this.setState({ taskCompleted: contentAfterSecondSection });
    } catch (error) {
      this.setState({ agentGuidance: "unknown error happened" });
    }
  }

  async getImageSasUrls() {
    //var caseNumber = (document.getElementById("casenumbertextarea") as HTMLTextAreaElement).value;
    var caseNumber = this.state.caseNumber;
    const imageListObj = await getImageSasUrls(String(caseNumber));
    this.setState({ imageList: imageListObj.data });
    const imageListWithGptvObj = await getGPTVInsights(imageListObj.data);
    this.setState({ imageList: imageListWithGptvObj.data });
  }

  onThumbnailClick = (imageUrl: string, imageInsights: string) => {
    this.setState({ selectedImage: imageUrl });
    this.setState({ gptvInsights: imageInsights });
  };

  openSettingsPanel = () => {
    this.setState({ isSettingsPanelOpen: true });
  };
  closeSettingsPanel = () => {
    this.setState({ isSettingsPanelOpen: false });
  };
  onConversationTemplateChange = () => {
    var conversationTemplateText = (
      document.getElementById(
        "conversationtemplatetextarea"
      ) as HTMLTextAreaElement
    ).value;
    this.setState({ conversationTemplate: conversationTemplateText });
  };

  onTranscriptTextareaChange = () => {
    var transcritionText = (
      document.getElementById("transcriptTextarea") as HTMLTextAreaElement
    ).value;
    this.setState({ displayText: transcritionText });
  };

  onClearAllTextarea = () => {
    this.setState({ displayText: "" });
    this.setState({ displayNLPOutput: "" });
    this.setState({ displayKeyPhrases: "" });
    this.setState({ displayPiiText: "" });
    this.setState({ gptInsightsOutput: "" });
    (
      document.getElementById("customPromptTextarea") as HTMLTextAreaElement
    ).value = "";
    (
      document.getElementById("transcriptTextarea") as HTMLTextAreaElement
    ).value = "";
  };

  render() {
    return (
      <div style={{ fontFamily: "source-sans-pro, sans-serif" }}>
        <Header />
        <div
          style={{
            height: "3rem",
            backgroundColor: "#c9e0f5",
            display: "flex",
          }}
        >
          <p style={{ paddingTop: "1rem", paddingLeft: "1rem" }}>
            Customers in this conversation:
          </p>
          <h1
            style={{
              backgroundColor: "#c9e0f5",
              marginBottom: 0,
              padding: "0.5rem",
              textDecoration: "underline #004FB6",
              fontSize: "2rem",
              marginLeft: "1rem",
            }}
          >
            Mrs. Jane Doe
          </h1>
          <p
            style={{
              color: "#004FB6",
              paddingTop: "1rem",
              marginLeft: "1rem",
            }}
          >
            Add customer
          </p>
        </div>
        <div
          style={{
            height: "3rem",
            backgroundColor: "#585b75",
            display: "flex",
          }}
        >
          <p
            style={{
              paddingInline: "1rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            Contact history
          </p>
          <p
            style={{
              paddingInline: "0.5rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            |
          </p>
          <p
            style={{
              paddingInline: "1rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            MyAviva account manager
          </p>
          <p
            style={{
              paddingInline: "0.5rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            |
          </p>
          <p
            style={{
              paddingInline: "1rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            Alerts
          </p>
          <p
            style={{
              paddingInline: "0.5rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            |
          </p>
          <p
            style={{
              paddingInline: "1rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            Complaint
          </p>
          <p
            style={{
              paddingInline: "0.5rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            |
          </p>
          <p
            style={{
              paddingInline: "1rem",
              color: "white",
              paddingTop: "0.75rem",
              fontWeight: "700",
            }}
          >
            Pension Wise
          </p>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ width: "5%", backgroundColor: "lightgray" }}></div>
          <div
            style={{ width: "35%", paddingLeft: "1rem", overflow: "scroll" }}
          >
            <p
              style={{
                fontSize: "2rem",
                paddingTop: "2rem",
                paddingBottom: "2rem",
              }}
            >
              Mrs. Jane Doe
            </p>
            <p style={{ marginBlock: "1rem" }}>
              MyAviva status:{" "}
              <span style={{ color: "red" }}>Not Registered</span>
            </p>
            <p style={{ marginBlock: "1rem" }}>Date of birth: 01/02/1980</p>
            <p style={{ marginBlock: "1rem" }}>
              Address: 1 Green Street <br /> London <br /> E1 1AA
            </p>
            <p style={{ marginBlock: "1rem" }}>Email: janedoe3@gmail.com</p>
            <p style={{ marginBlock: "1rem" }}>
              Contact number(s): <br /> 07700 900 900 <br /> 020 1234 5678
            </p>
          </div>
          <div style={{ width: "60%", boxShadow: "0 0 5px" }}>
            <div
              style={{
                backgroundColor: "#FFD900",
                textAlign: "center",
                boxShadow: "0 0 5px",
                padding: "1rem",
              }}
            >
              <img
                src="https://static.aviva.io/assets/logo/aviva-logo.svg"
                decoding="async"
                alt=""
              ></img>
              <h3
                style={{
                  color: "#004FB6",
                }}
              >
                Agent Assist
              </h3>
              <form>
                <div>
                  <div
                    style={{ justifyContent: "space-between", width: "100%" }}
                  >
                    <PrimaryButton
                      className="customButtons2"
                      onClick={() => this.sttFromMic()}
                      style={{
                        borderRadius: "0.375rem",
                        width: "auto",
                        padding: "0.5rem",
                        backgroundColor: "#004FB6",
                      }}
                    >
                      Start Conversation
                    </PrimaryButton>
                    &emsp; &ensp;
                    <DefaultButton
                      className="customButtons2"
                      onClick={() => this.stopRecording()}
                      style={{
                        borderRadius: "0.375rem",
                        width: "auto",
                        padding: "0.5rem",
                      }}
                    >
                      End Conversation
                    </DefaultButton>
                    &emsp; &ensp;
                    <PrimaryButton
                      className="customButtons2"
                      onClick={this.openSettingsPanel}
                      style={{
                        borderRadius: "0.375rem",
                        width: "auto",
                        padding: "0.5rem",
                        backgroundColor: "#004FB6",
                      }}
                    >
                      Settings
                    </PrimaryButton>
                    <Delete24Regular
                      id="clearAlltextarea"
                      color="gray"
                      onClick={this.onClearAllTextarea}
                    ></Delete24Regular>
                    <Panel
                      headerText="Application Settings"
                      isOpen={this.state.isSettingsPanelOpen}
                      isBlocking={false}
                      onDismiss={this.closeSettingsPanel}
                    >
                      <p></p>
                      <Label>Spoken Language for Conversation</Label>
                      <Dropdown
                        placeholder="Select Language"
                        id="selectSpokenConvLanguage"
                        options={SpokenLanguageOptions()}
                        selectedKey={this.state.spokenLanguage}
                        onChange={this.handleSpokenLangDropdownChange}
                      />{" "}
                      <p></p>
                      <Label>Conversation Scenario</Label>
                      <Dropdown
                        placeholder="Select Conversation Scenario"
                        id="selectScenario"
                        options={ScenarioOptions()}
                      />{" "}
                      <p></p>
                      <div className="panelsection-container">
                        <Label>Select AI Features to Show:</Label>
                        <Toggle
                          label="Live Transcription"
                          onText="Shown"
                          offText="Hidden"
                          inlineLabel
                          checked={this.state.showTranscriptPanel}
                          onChange={this.handleTranscriptPanelToggleChange}
                        />
                        <Toggle
                          label="Custom Prompts"
                          onText="Shown"
                          offText="Hidden"
                          inlineLabel
                          checked={this.state.showPromptPanel}
                          onChange={this.handlePromptPanelToggleChange}
                        />
                        <Toggle
                          label="GPT-Vision"
                          onText="Shown"
                          offText="Hidden"
                          inlineLabel
                          checked={this.state.showPhotoPanel}
                          onChange={this.handlePhotoPanelToggleChange}
                        />
                        <Toggle
                          label="Live Guidance"
                          onText="Enabled"
                          offText="Disabled"
                          inlineLabel
                          checked={this.state.copilotChecked}
                          onChange={this.handleToggleChange}
                        />
                      </div>
                      {this.state.copilotChecked && (
                        <div className="copilotsection-container">
                          <Label>Live Guidance Settings</Label>
                          <div>
                            <TextField
                              label="Enter task/question list for Live Guidance"
                              multiline
                              autoAdjustHeight
                              id="conversationtemplatetextarea"
                              defaultValue={this.state.conversationTemplate}
                              onChange={this.onConversationTemplateChange}
                            />
                          </div>
                        </div>
                      )}
                      <Label>
                        Demo delivery instruction video & resources are{" "}
                        <a
                          href="https://conversationcopilotdemo.z14.web.core.windows.net/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          available here
                        </a>
                      </Label>
                      <PrimaryButton
                        text="Close"
                        className="customButtons2"
                        onClick={this.closeSettingsPanel}
                        styles={{ root: { marginTop: "16px" } }}
                      />
                    </Panel>
                  </div>
                </div>
              </form>
            </div>

            {this.state.copilotChecked && (
              <div className="llm-area-container">
                <div className="row">
                  <div className="col-6">
                    <Pivot aria-label="Converstion Guidance">
                      <PivotItem headerText="Pending Tasks (Live Guidance)">
                        <textarea
                          className="form-control"
                          id="taskPendingTextarea"
                          rows={10}
                          defaultValue={this.state.agentGuidance}
                        ></textarea>
                      </PivotItem>
                    </Pivot>
                  </div>
                  <div className="col-6">
                    <Pivot aria-label="Converstion Insights">
                      <PivotItem headerText="Completed Tasks (Live Guidance)">
                        <textarea
                          className="form-control"
                          id="taskCompletedTextarea"
                          rows={10}
                          defaultValue={this.state.taskCompleted}
                        ></textarea>
                      </PivotItem>
                    </Pivot>
                  </div>
                </div>
              </div>
            )}

            {this.state.showTranscriptPanel && (
              <div
                style={{ padding: "0.5rem" }}
                className="transcript-area-container"
              >
                <div>
                  <div className="row">
                    <div className="col-6">
                      <Pivot aria-label="Transcriptions">
                        <PivotItem headerText="Real-time Conversation Transcript">
                          <textarea
                            className="form-control"
                            id="transcriptTextarea"
                            rows={10}
                            style={{ height: "250px", boxShadow: "0 0 5px" }}
                            defaultValue={this.state.displayText}
                            onChange={this.onTranscriptTextareaChange}
                          />
                        </PivotItem>
                        {this.state.showPIIRedactedTranscript && (
                          <PivotItem headerText="PII-redacted Transcript">
                            <textarea
                              className="form-control"
                              id="piiTextarea"
                              rows={10}
                              defaultValue={this.state.displayPiiText}
                              style={{ height: "250px", boxShadow: "0 0 5px" }}
                            ></textarea>
                          </PivotItem>
                        )}
                      </Pivot>
                    </div>
                    <div className="col-6">
                      <Pivot aria-label="Language AI insights">
                        <PivotItem headerText="Entities Extracted">
                          <textarea
                            className="form-control"
                            id="entitiesTextarea"
                            rows={10}
                            style={{ height: "250px", boxShadow: "0 0 5px" }}
                            defaultValue={this.state.displayNLPOutput}
                          ></textarea>
                        </PivotItem>
                      </Pivot>
                    </div>
                  </div>
                  <div style={{ marginTop: "1rem" }}>
                    <div>
                      <PrimaryButton
                        style={{
                          borderRadius: "0.375rem",
                          backgroundColor: "#004FB6",
                          width: "auto",
                        }}
                        className="customButtons2"
                        onClick={() => this.gptCustomPromptCompetion()}
                      >
                        Ask GPT
                      </PrimaryButton>
                      <div className="row text-dark">
                        <div className="col-6">
                          <label
                            form="customPromptTextarea"
                            className="form-label"
                            style={{ color: "black", display: "none" }}
                          >
                            Prompt engineering to extract custom Business
                            Insights:{" "}
                          </label>
                          &emsp; &ensp;
                          <textarea
                            className="form-control"
                            id="customPromptTextarea"
                            rows={10}
                            style={{ height: "250px", boxShadow: "0 0 5px" }}
                          ></textarea>
                        </div>
                        <div className="col-6">
                          <textarea
                            className="form-control"
                            style={{
                              height: "250px",
                              boxShadow: "0 0 5px",
                              marginTop: "22px",
                            }}
                            id="entitiesTextarea"
                            rows={12}
                            defaultValue={this.state.gptInsightsOutput}
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <PrimaryButton
                      style={{
                        width: "auto",
                        marginLeft: "1rem",
                        marginTop: "1rem",
                        marginBottom: 0,
                        borderRadius: "0.375rem",
                        backgroundColor: "#004FB6",
                      }}
                      text="Generate Instructions"
                      onClick={async () => {
                        this.setState({
                          customInstructions: (
                            <ClipLoader
                              color={"#004FB6"}
                              loading={true}
                              size={50}
                              aria-label="Loading Spinner"
                              data-testid="loader"
                            />
                          ),
                        });
                        await setTimeout(() => {
                          this.setState({
                            customInstructions: (
                              <>
                                <p>
                                  <span style={{ fontSize: "2rem" }}>
                                    Vulnerablility identified &rarr;{" "}
                                  </span>
                                  <span
                                    style={{
                                      color: "red",
                                      textDecoration: "underline",
                                      fontSize: "2rem",
                                    }}
                                  >
                                    {" "}
                                    Update Flag
                                  </span>{" "}
                                  (This will update our marketing and data
                                  records)
                                </p>
                                <ul>
                                  <li>
                                    Unisure - journey available within MyAviva
                                    &rarr;{" "}
                                    <span style={{ color: "red" }}>No</span> -
                                    due to policy being with profits
                                  </li>
                                  <li>
                                    MyMoney - journey available within MyAviva
                                    &rarr;{" "}
                                    <span style={{ color: "green" }}>Yes</span>
                                  </li>
                                  <ul>
                                    <li>
                                      {" "}
                                      Customer not registered &rarr;{" "}
                                      <PrimaryButton
                                        className="customButtons2"
                                        onClick={() => this.sttFromMic()}
                                        style={{
                                          borderRadius: "0.375rem",
                                          width: "auto",
                                          padding: "0.5rem",
                                          backgroundColor: "#004FB6",
                                        }}
                                      >
                                        Activate Registration
                                      </PrimaryButton>
                                    </li>
                                    <li>
                                      Provide online guidance &rarr;{" "}
                                      <PrimaryButton
                                        className="customButtons2"
                                        onClick={() => this.sttFromMic()}
                                        style={{
                                          borderRadius: "0.375rem",
                                          width: "auto",
                                          padding: "0.5rem",
                                          backgroundColor: "#004FB6",
                                        }}
                                      >
                                        Trigger how-to guide in MyAviva message
                                        centre
                                      </PrimaryButton>
                                    </li>
                                  </ul>
                                </ul>
                                <h2>Suggested converations:</h2>
                                <ul>
                                  <li>
                                    Does the customer wants to service their
                                    products digitally ?
                                  </li>
                                  <li>
                                    Vulnerabiltiy is financial hardship: refer
                                    customer: <a href="www.fca.com">FCA</a> ,{" "}
                                    <a href="www.fca.com">MoneyHelper</a> &{" "}
                                    <a href="www.fca.com">CitizensAdvice</a>
                                  </li>
                                </ul>
                              </>
                            ),
                          });
                        }, 500);
                      }}
                    />
                    <Pivot aria-label="Language AI insights">
                      <PivotItem headerText="Customer Instructions">
                        <div
                          style={{
                            height: "250px",
                            boxShadow: "0 0 5px",
                            borderWidth: "1px",
                            borderColor: "#dee2e6",
                            borderStyle: "solid",
                            overflow: "auto",
                            borderRadius: "0.375rem",
                            padding: "0.5rem",
                          }}
                        >
                          {this.state.customInstructions}
                        </div>
                      </PivotItem>
                    </Pivot>
                  </div>
                </div>
              </div>
            )}

            {this.state.showPhotoPanel && (
              <div className="image-area-container">
                <div className="row">
                  <div className="col-1 colMarginOffset"></div>
                  <div className="col-5">
                    <Pivot aria-label="ImageInsights">
                      <PivotItem headerText="Upload Photos">
                        <form>
                          <TextField
                            label="Case number:"
                            id="casenumbertextarea"
                            className="textField"
                            defaultValue={String(this.state.caseNumber)}
                          />
                          <div>
                            <PrimaryButton
                              className="customButtons2"
                              onClick={() => {
                                const url = `/upload/${this.state.caseNumber}`;
                                window.open(url, "_blank");
                              }}
                            >
                              {" "}
                              Go to Photo Upload
                            </PrimaryButton>
                            <PrimaryButton
                              className="customButtons2"
                              onClick={() => this.getImageSasUrls()}
                            >
                              Ask GPT-Vision
                            </PrimaryButton>
                          </div>
                        </form>
                      </PivotItem>
                      <PivotItem headerText="Received photos">
                        <div className="row">
                          <div className="col-4">
                            {this.state.imageList.map((image, index) => (
                              <img
                                key={index}
                                src={image.sasUrl}
                                alt={image.name}
                                className="thumbnail"
                                onClick={() =>
                                  this.onThumbnailClick(
                                    image.sasUrl,
                                    image.imageInsights
                                  )
                                }
                              />
                            ))}
                          </div>
                          <div className="col-8">
                            {this.state.selectedImage && (
                              <img
                                src={this.state.selectedImage}
                                alt="Selected"
                                className="selected-image"
                              />
                            )}
                          </div>
                        </div>
                      </PivotItem>
                    </Pivot>
                  </div>
                  <div className="col-6">
                    <Pivot aria-label="Photo insights">
                      <PivotItem headerText="Photo insights (using GPT-Vision model)">
                        <textarea
                          className="form-control customTextarea"
                          id="imageInsightsTextarea"
                          rows={12}
                          defaultValue={this.state.gptvInsights}
                        ></textarea>
                      </PivotItem>
                    </Pivot>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } //end of render method
} //end of App class
