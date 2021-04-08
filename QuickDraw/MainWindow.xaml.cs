﻿using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Windows.Forms;
using System.IO;
using FolderDialog;
using System.Runtime.InteropServices;

namespace QuickDraw
{
    public class Message
    {
        public string type { get; set; }
    }

    public class OpenFolderMessage : Message
    {
        public string path { get; set; }
    }

    public struct ImageFolder
    {
        public string Path { get; set; }

        public int Count { get; set; }
    }

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private void WebViewAddFolders(List<ImageFolder> folders)
        {
            string jsonString = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                { "type", "AddFolders" },
                { "data", folders }
            });

            webView.CoreWebView2.PostWebMessageAsJson(jsonString);

            Debug.WriteLine(jsonString);
        }

        public MainWindow()
        {
            InitializeComponent();

            InitializeAsync();

        }

        private async void InitializeAsync()
        {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "quickdraw.assets", "WebSrc",
                Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.DenyCors
            );

            webView.CoreWebView2.WebMessageReceived += ReceiveMessage;
        }

        private void OpenFolderInExplorer(string path)
        {
            if (Directory.Exists(path))
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    Arguments = path,
                    FileName = "explorer.exe"
                };

                Process.Start(startInfo);
            }
        }

        private async void OpenFolders()
        {

            List <ImageFolder> folders  = await Task<uint>.Run(() =>
            {
                List<ImageFolder> folders = new List<ImageFolder>();

                IFileOpenDialog dialog = null;
                uint count = 0;
                try
                {
                    dialog = new NativeFileOpenDialog();
                    dialog.SetOptions(
                        FileOpenDialogOptions.NoChangeDir
                        | FileOpenDialogOptions.PickFolders
                        | FileOpenDialogOptions.AllowMultiSelect
                        | FileOpenDialogOptions.PathMustExist
                    );
                    dialog.Show(IntPtr.Zero);


                    IShellItemArray shellItemArray = null;
                    dialog.GetResults(out shellItemArray);

                    if (shellItemArray != null)
                    {
                        IntPtr i_result;
                        string filepath = null;
                        shellItemArray.GetCount(out count);

                        for (uint i = 0; i < count; i++)
                        {
                            IShellItem shellItem = null;

                            shellItemArray.GetItemAt(i, out shellItem);

                            if (shellItem != null)
                            {
                                shellItem.GetDisplayName(SIGDN.FILESYSPATH, out i_result);
                                filepath = Marshal.PtrToStringAuto(i_result);
                                Marshal.FreeCoTaskMem(i_result);

                                var files = Directory.EnumerateFiles(filepath, "*.*", SearchOption.AllDirectories)
                                    .Where(s => s.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase)
                                            || s.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)
                                            || s.EndsWith(".png", StringComparison.OrdinalIgnoreCase));

                                folders.Add(new ImageFolder { Path = filepath, Count = files.Count() });
                            }
                        }
                    }
                }
                catch(System.Runtime.InteropServices.COMException)
                {
                    // No files or other weird error, do nothing.
                }
                finally
                {
                    if (dialog != null)
                        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(dialog);
                }
                return folders;
            });

            if (folders.Count > 0)
            {
                WebViewAddFolders(folders);
            }
        }

        private void ReceiveMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            Message message = JsonSerializer.Deserialize<Message>(args.WebMessageAsJson);
            
            switch(message.type)
            {
                case "addFolders":
                    OpenFolders();
                    break;
                case "openFolder":
                    OpenFolderMessage openFolderMessage = JsonSerializer.Deserialize<OpenFolderMessage>(args.WebMessageAsJson);
                    OpenFolderInExplorer(openFolderMessage.path);
                    break;
                default:
                    break;
            }
        }
    }
}
