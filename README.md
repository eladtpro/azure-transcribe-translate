# The Client-Side of Azure AI Services
![Azure AI Services](/assets/services.png)


The purpose of this solution is to enable apps to incorporate AI capabilities. In the upcoming demo, I will demonstrate how to **transcribe**, **translate**, **summarize** and **speech** conversations between customers and businesses without making significant modifications to your existing apps.

This app can be useful in various scenarios where two parties speak different languages and require simultaneous translation.  
For example, **it can be employed in call centers, where the representative and the customer do not speak the same language, by bank tellers dealing with foreign clients, by doctors communicating with elderly patients who do not speak the native language well**, and in other similar situations where both parties need to converse in their respective native languages.

In the solution we will use the client-side of the Azure AI Services. The app's backend is a slim **Next.js** Node.js server that uses Azure Web PubSub for **Socket.IO** to provide real-time, duplex communication between the client and the server. Furthermore, the Next.js slim backend is hosted using **Azure Container Apps**.

## <a name="scenario"></a>Scenario explaned

![Diagram](/assets/Translator.png)

![Steps](/assets/steps.png)


[Prerequisites](#prerequisites)  
[Prepare the environment](#prepare)  
[Running it locally](#local)  
[Provision Azure Container App as a Next.js backend](#containerapp)  
[Resources Deployed in this solution (Azure)](#resources)
[Improve recognition accuracy with custom speech](#improve)
[Links](#links)



## <a name="prerequisites"></a>Prerequisites

> **Note:** This solution focus on the client-side of Azure AI Services. In order to keep the solution simple we will create the souronding resources manually using the Azure portal.

* Active Azure subscription. If you don't have an Azure subscription, you can [create one for free](https://azure.microsoft.com/free/cognitive-services/)
* [Create a Speech resource](https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices) in the Azure portal.
* [Create a Translator resource](https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation) in the Azure portal.
* [create a Language resource](https://portal.azure.com/#create/Microsoft.CognitiveServicesTextAnalytics) in the Azure portal
* [Create a Container Registry](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-get-started-portal?tabs=azure-cli) in the Azure portal.
* Create Azure Web PubSub for Socket.IO resource using [this guide](https://learn.microsoft.com/en-us/azure/azure-web-pubsub/socketio-quickstart)


## <a name="prepare"></a>Prepare the environment

#### Get the repository

[Fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) this repository to your enviroment.

> **Optional**: configure Git to pull changes from the upstream repository into the local clone of your fork
> git remote set-url origin https://github.com/> userName/New_Repo
> git remote add upstream https://github.com/userName/Repo
> git push origin master
> git push --all


#### Set the Next.js environment variables (.env)
> **Note:** Next.js local server is using the .env file to load the environment variables. The .env file should be created in the root of the project.
> **Important**: The .env file should NOT be commited to the repository.
> Use the [env.sample](/env.sample) template, create a new .env file in the project root and replace the placeholders with the actual values.

The .env file should look like this:
```
WEBSITE_HOSTNAME=http://localhost:3001
NODE_ENV='development'
PORT=3000
SOCKET_PORT=29011
SOCKET_ENDPOINT=https://<SOCKET_IO_SERVICE>.webpubsub.azure.com
SOCKET_CONNECTION_STRING=<SOCKET_IO_CONNECTION_STRING>
SPEECH_KEY=<SPEECH_KEY>
SPEECH_REGION=westeurope
LANGUAGE_KEY=<LANGUAGE_KEY>
LANGUAGE_REGION=westeurope
LANGUAGE_ENDPOINT=https://<LANGUAGE_SERVICE>.cognitiveservices.azure.com/
TRANSLATE_KEY=<TRANSLATE_KEY>
TRANSLATE_ENDPOINT=https://api.cognitive.microsofttranslator.com/
TRANSLATE_REGION=westeurope
```

#### Set the environment variables for the setup.sh script (.env.sh)
> **Note:** [setup.sh](/setup.sh) script creates the Azure Container App resource that will run the Next.js server. The script is using the .env.sh file to load the environment variables. The .env.sh file should be created in the root of the project.
> Use the [env.sh.sample](/env.sample) template, create a new .env.sh file in the project root and replace the placeholders with the actual values.
> **Important**: The .env.sh file should NOT be commited to the repository.
> **Important**: The .env.sh file is dependent on the .env file we have created in the previous step.

The .env.sh file should look like this:
```
RESOURCE_GROUP=<RESOURCE_GROUP>
LOCATION=westeurope
CONTAINER_APP_NAME=aiservices
CONTAINER_APP_IMAGE=<CONTAINER_REGISTRY>.azurecr.io/aiservices:latest
CONTAINER_APP_PORT=80
CONTAINER_REGISTRY_SERVER=<CONTAINER_REGISTRY>.azurecr.io
CONTAINER_REGISTRY_IDENTITY=system
CONTAINER_ENVIRONMENT_NAME=env-ai-services
LOGS_WORKSPACE_ID=<LOGS_WORKSPACE_ID>
LOGS_WORKSPACE_KEY=<LOGS_WORKSPACE_KEY>
SUBSCRIPTION_ID=<SUBSCRIPTION_ID>
```

#### Create service principal (App registration) and save it as GitHub secret

> The app registration service principal is used by the GitHub action for two roles, one role for pushing the images to the ACR, second role for deploying Azure Container Apps. for that the service principal should have the **Contributor** role at the Azure resource group.

```
# login to azure
az login
# create an service principle at the resource group level
az ad sp create-for-rbac --name aiservices-github --role Contributor --scopes /subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP} --sdk-auth
```

The command will result in a JSON output that looks like the JSON blobk bwlow,
**Copy the output and save it in a** [**GitHub secret**](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository) named AZURE_CREDENTIALS.:

```
{
  "clientId": "00000000-0000-0000-0000-000000000000",
  "clientSecret": "00000000000000000000000000000000",
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```
![GitHub secret](/assets/repo-secrets.png)


#### Set other enviroment variables for the GitHub action

At the GItHub repo setting, move to the **Variables** tab.
1. Set the **CONTAINER_REGISTRY** variable to the name of the Azure Container Registry.
2. Set the **RESOURCE_GROUP** variable for the resource group where you Container registry.
3. Set the **CONTAINER_APP_NAME** variable to the name of the Azure Container App.

![GitHub environment variables](/assets/repo-vars.png)

## <a name="local"></a>Run it locally
After creating the Azure resources and setting up the environment, you can run the Next.js app locally.

```
npm install
npm run dev
```

This command will start the Next.js server on port 3000, the server will also will serve the client-side static files.
After the app is running, you can access it locally at [http://localhost:3000](http://localhost:3000)


## <a name="containerapp"></a>Run it  as Azure Container App

Run the [setup.sh](/setup.sh) script to create the Azure Container App resource that will run the Next.js server on Azure.

```
az login
./setup.sh
```

Wait for the app to be deployed, the result will be the FQDN of the Azure Container App. 
You can get the FQDN by running the following command:
```
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn 
```


> **Note:** You can also get the Application Url on the Container App resource overview blade.


We are done with setup part.  
Now you can access the app at the URL of the Azure Container App.

## Sample Application - how to use it

![App](/assets/application-screenshot.png)

* **Listen**: Start the speech-to-text transcription, this will use the [Speech to text SDK for JavaScript package](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/?view=azure-node-latest).  
On the listener side each recognized phrase will be translated to the selected language using the **Trabslation** service REST API.
* Summarize: Summarize the conversation.


## <a name="resources"></a>Resources Deployed in this solution (Azure)

![Azure AI Services](/assets/azure-resources.png)

* Container Registry: for the next.js app container image.
* Container App (& Container App Environment)  : for the next.js app.
* Language Service: for the conversation summarization.
* Log Analytics Workspace: for the logs of the container app.
* Web PubSub for Socket.IO: for the real-time, duplex communication between the client and the server.
* Speech service: for the speech-to-text transcription capbilites.
* Translator service: for the translation capabilities.



## <a name="improve"></a>Improve recognition accuracy with custom speech
> Source: [What is custom speech?](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-speech-overview)

#### How does it work?
With custom speech, you can upload your own data, test and train a custom model, compare accuracy between models, and deploy a model to a custom endpoint.

![Custom Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/media/custom-speech/custom-speech-overview.png)


Here's more information about the sequence of steps shown in the previous diagram:

1. [Create a project](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-create-project) and choose a model. Use a [Speech resource](https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices) that you create in the Azure portal. If you train a custom model with audio data, choose a Speech resource region with dedicated hardware for training audio data. For more information, see footnotes in the [regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions#speech-service) table.
2. [Upload test data](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-upload-data). Upload test data to evaluate the speech to text offering for your applications, tools, and products.
3. [Test recognition quality](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-inspect-data). Use the [Speech Studio](https://aka.ms/speechstudio/customspeech) to play back uploaded audio and inspect the speech recognition quality of your test data.
4. [Test model quantitatively](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-evaluate-data). Evaluate and improve the accuracy of the speech to text model. The Speech service provides a quantitative word error rate (WER), which you can use to determine if more training is required.
5. [Train a model](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-train-model). Provide written transcripts and related text, along with the corresponding audio data. Testing a model before and after training is optional but recommended.
6. [Deploy a model](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-deploy-model). Once you're satisfied with the test results, deploy the model to a custom endpoint. Except for [batch transcription](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription), you must deploy a custom endpoint to use a custom speech model.





## <a name="con"></a>Conclusion
In this solution, we have demonstrated how to use the client-side of Azure AI Services to enable apps to incorporate AI capabilities. We have shown how to transcribe, translate, summarize, and speech conversations between customers and businesses without making significant modifications to your existing apps. This app can be useful in various scenarios where two parties speak different languages and require simultaneous translation. For example, it can be employed in call centers, where the representative and the customer do not speak the same language, by bank tellers dealing with foreign clients, by doctors communicating with elderly patients who do not speak the native language well, and in other similar situations where both parties need to converse in their respective native languages.

## <a name="links"></a>Links
* [Use continuous speech recognition](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech?pivots=programming-language-javascript#use-continuous-recognition)
* [How to synthesize speech from text](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis?tabs=browserjs%2Cterminal&pivots=programming-language-javascript)
* [Quickstart: Convert text to speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-text-to-speech?tabs=windows%2Cterminal&pivots=programming-language-javascript)
* [Speech React browser-based JavaScript sample](https://github.com/Azure-Samples/AzureSpeechReactSample)
* [Implement language identification](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification?tabs=once&pivots=programming-language-javascript)
* [How to use conversation summarization](https://learn.microsoft.com/en-us/azure/ai-services/language-service/summarization/how-to/conversation-summarization)
* [Build a real-time code-streaming app by using Socket.IO and host it on Azure](https://learn.microsoft.com/en-us/azure/azure-web-pubsub/socketio-build-realtime-code-streaming-app)
* [Update and deploy changes in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
* [Language support for document and conversation summarization](https://learn.microsoft.com/en-us/azure/ai-services/language-service/summarization/language-support)
* [Language and voice support for the Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts#prebuilt-neural-voices)
* [Socket.io Server options](https://socket.io/docs/v4/server-options/)
* [az containerapp](https://learn.microsoft.com/en-us/cli/azure/containerapp?view=azure-cli-latest)